#!/usr/bin/env node
/**
 * Seeds the CognoDB graph with a plausible slice of West Sumatra's creative
 * ecosystem, then verifies that the queries the app depends on actually return
 * something against the data it just wrote.
 *
 * The verification step is the point. A seed that "succeeds" while leaving
 * Query A empty or every talent two hops from every other talent would pass a
 * naive smoke test and still make the demo meaningless, so the checks at the
 * bottom of this file are treated as part of the seed, not as a nicety.
 *
 * Connection handling goes through the same singleton the application uses
 * (`src/lib/cognodb.ts`), so this script exercises the exact code path that
 * serves requests — including its config validation and error taxonomy.
 *
 * Usage: npm run seed
 */

import 'dotenv/config';
import {
  DatabaseConfigError,
  DatabaseUnavailableError,
  closeDriver,
  readQuery,
  writeQuery,
} from '../src/lib/cognodb.ts';
import { PATH_QUERY, RECOMMENDATIONS_QUERY } from '../src/lib/graph.ts';
import { FEATURED_ENTITIES } from '../src/lib/featured.ts';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/** Mirrors docs/database.md §2.2. Applied before any data is written. */
const SCHEMA_STATEMENTS = [
  'CREATE CONSTRAINT talent_id     IF NOT EXISTS FOR (t:Talent)     REQUIRE t.id   IS UNIQUE',
  'CREATE CONSTRAINT project_id    IF NOT EXISTS FOR (p:Project)    REQUIRE p.id   IS UNIQUE',
  'CREATE CONSTRAINT agency_id     IF NOT EXISTS FOR (a:Agency)     REQUIRE a.id   IS UNIQUE',
  'CREATE CONSTRAINT collective_id IF NOT EXISTS FOR (c:Collective) REQUIRE c.id   IS UNIQUE',
  'CREATE CONSTRAINT skill_id      IF NOT EXISTS FOR (s:Skill)      REQUIRE s.id   IS UNIQUE',
  'CREATE CONSTRAINT skill_name    IF NOT EXISTS FOR (s:Skill)      REQUIRE s.name IS UNIQUE',
  'CREATE INDEX talent_name  IF NOT EXISTS FOR (t:Talent)  ON (t.name)',
  'CREATE INDEX project_year IF NOT EXISTS FOR (p:Project) ON (p.year)',
];

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

const SKILLS = [
  { id: 'skill-directing', name: 'Directing', category: 'Story' },
  { id: 'skill-screenwriting', name: 'Screenwriting', category: 'Story' },
  { id: 'skill-cinematography', name: 'Cinematography', category: 'Craft' },
  { id: 'skill-editing', name: 'Editing', category: 'Craft' },
  { id: 'skill-colour-grading', name: 'Colour Grading', category: 'Craft' },
  { id: 'skill-sound-design', name: 'Sound Design', category: 'Craft' },
  { id: 'skill-2d-animation', name: '2D Animation', category: 'Motion' },
  { id: 'skill-3d-modelling', name: '3D Modelling', category: 'Motion' },
  { id: 'skill-motion-graphics', name: 'Motion Graphics', category: 'Motion' },
  { id: 'skill-vfx-compositing', name: 'VFX Compositing', category: 'Motion' },
  { id: 'skill-makeup-artistry', name: 'Makeup Artistry', category: 'Presentation' },
  { id: 'skill-production-design', name: 'Production Design', category: 'Presentation' },
];

const TALENTS = [
  {
    id: 'talent-rian-syahputra',
    name: 'Rian Syahputra',
    role: 'Director',
    location: 'Padang',
    bio: 'Feature director who came up shooting weddings in Pariaman and still edits his own rough cuts.',
  },
  {
    id: 'talent-dita-anggraini',
    name: 'Dita Anggraini',
    role: 'Director',
    location: 'Bukittinggi',
    bio: 'Moves between fiction and documentary; her Randai film screened at four regional festivals.',
  },
  {
    id: 'talent-fajar-maulana',
    name: 'Fajar Maulana',
    role: 'Director of Photography',
    location: 'Padang',
    bio: 'Available-light specialist, known for handheld coverage in cramped interiors.',
  },
  {
    id: 'talent-intan-suryani',
    name: 'Intan Suryani',
    role: 'Director of Photography',
    location: 'Bukittinggi',
    bio: 'Shoots and grades her own work, which makes her the cheapest post pipeline in the province.',
  },
  {
    id: 'talent-bayu-pratama',
    name: 'Bayu Pratama',
    role: 'Editor',
    location: 'Padang',
    bio: 'Cuts long-form documentary and teaches an editing class at a Padang polytechnic on weekends.',
  },
  {
    id: 'talent-lia-marlina',
    name: 'Lia Marlina',
    role: 'Editor',
    location: 'Payakumbuh',
    bio: 'Documentary editor who prefers to be on location during the shoot rather than take rushes cold.',
  },
  {
    id: 'talent-arif-rahman',
    name: 'Arif Rahman',
    role: 'Colourist',
    location: 'Padang',
    bio: 'Runs the only calibrated grading suite between Padang and Pekanbaru.',
  },
  {
    id: 'talent-yusra-hakim',
    name: 'Yusra Hakim',
    role: 'Sound Designer',
    location: 'Payakumbuh',
    bio: 'Field recordist turned designer; keeps a library of Harau valley ambiences he refuses to license out.',
  },
  {
    id: 'talent-nadia-sabri',
    name: 'Nadia Sabri',
    role: 'Sound Designer',
    location: 'Padang',
    bio: 'Handles dialogue edit and mix for most of the animation work coming out of Padang.',
  },
  {
    id: 'talent-elok-permata',
    name: 'Elok Permata',
    role: 'Makeup Artist',
    location: 'Bukittinggi',
    bio: 'Prosthetics and period looks; built the ageing makeup for a Randai documentary on a two-day budget.',
  },
  {
    id: 'talent-sari-wulandari',
    name: 'Sari Wulandari',
    role: 'Makeup Artist',
    location: 'Padang',
    bio: 'Commercial beauty work by day, doubles as a set dresser when a production runs short.',
  },
  {
    id: 'talent-gilang-ramadhan',
    name: 'Gilang Ramadhan',
    role: 'Animator',
    location: 'Padang',
    bio: 'Character animator on the Minangkabau folktale shorts; storyboards before he keyframes.',
  },
  {
    id: 'talent-mira-oktavia',
    name: 'Mira Oktavia',
    role: 'Animator',
    location: 'Bukittinggi',
    bio: 'Frame-by-frame animator who moved into motion graphics to keep the lights on.',
  },
  {
    id: 'talent-taufik-hidayat',
    name: 'Taufik Hidayat',
    role: '3D Artist',
    location: 'Padang',
    bio: 'Environment modeller; rebuilt Jam Gadang in Blender for an ad and never deleted the file.',
  },
  {
    id: 'talent-rani-permatasari',
    name: 'Rani Permatasari',
    role: '3D Artist',
    location: 'Payakumbuh',
    bio: 'Lookdev and lighting, with enough compositing to finish a shot without waiting on anyone.',
  },
  {
    id: 'talent-hendra-gunawan',
    name: 'Hendra Gunawan',
    role: 'VFX Artist',
    location: 'Padang',
    bio: 'Cleanup, roto, and set extension for commercials that budgeted for none of it.',
  },
  {
    id: 'talent-vina-anjani',
    name: 'Vina Anjani',
    role: 'Motion Designer',
    location: 'Bukittinggi',
    bio: 'Titles and broadcast packaging; the reason three local stations share a house style.',
  },
  {
    id: 'talent-doni-saputra',
    name: 'Doni Saputra',
    role: 'Motion Designer',
    location: 'Padang',
    bio: 'Animates the explainer work for banks and telcos, and hates being called an animator.',
  },
  {
    id: 'talent-kiki-ananda',
    name: 'Kiki Ananda',
    role: 'Screenwriter',
    location: 'Solok',
    bio: 'Writes documentary treatments and does the field research herself before a word is drafted.',
  },
  {
    id: 'talent-reza-fadillah',
    name: 'Reza Fadillah',
    role: 'Screenwriter',
    location: 'Padang',
    bio: 'Came from advertising copy; fast on structure, slower on dialogue, honest about both.',
  },
  {
    id: 'talent-anisa-fitri',
    name: 'Anisa Fitri',
    role: 'Production Designer',
    location: 'Bukittinggi',
    bio: 'Sources period props from family houses across Agam rather than building them.',
  },
  {
    id: 'talent-oki-firdaus',
    name: 'Oki Firdaus',
    role: 'Production Designer',
    location: 'Padang',
    bio: 'Art department lead who keeps a warehouse of set flats near Batang Arau.',
  },
  {
    id: 'talent-tia-rahmadani',
    name: 'Tia Rahmadani',
    role: 'Director of Photography',
    location: 'Payakumbuh',
    bio: 'Documentary shooter, comfortable operating alone for weeks at a time.',
  },
  {
    id: 'talent-surya-lesmana',
    name: 'Surya Lesmana',
    role: 'Editor',
    location: 'Bukittinggi',
    bio: 'Music video and short-form cutter with a reputation for turning a mess around overnight.',
  },
  {
    id: 'talent-melati-ningsih',
    name: 'Melati Ningsih',
    role: 'Colourist',
    location: 'Padang',
    bio: 'Grades commercials and music videos, and does the conform nobody else wants to.',
  },
  {
    id: 'talent-ihsan-fadli',
    name: 'Ihsan Fadli',
    role: 'Sound Designer',
    location: 'Bukittinggi',
    bio: 'Location sound on documentary crews; the mixer everyone borrows is his.',
  },
  {
    id: 'talent-wulan-safitri',
    name: 'Wulan Safitri',
    role: 'Animator',
    location: 'Payakumbuh',
    bio: 'Cut-out and rotoscope animation, mostly for music videos with no budget for anything else.',
  },
  {
    id: 'talent-ade-kurniawan',
    name: 'Ade Kurniawan',
    role: '3D Artist',
    location: 'Padang',
    bio: 'Product and architectural visualisation; the industrial clients keep him busiest.',
  },
  {
    id: 'talent-nurul-hasanah',
    name: 'Nurul Hasanah',
    role: 'Makeup Artist',
    location: 'Payakumbuh',
    bio: 'Special effects makeup, self-taught from forums, now teaching it back at a vocational school.',
  },
  {
    id: 'talent-bimo-arya',
    name: 'Bimo Arya',
    role: 'Director',
    location: 'Pariaman',
    bio: 'Just finished film school in Yogyakarta and moved home; no professional credits in the province yet.',
  },
];

const AGENCIES = [
  {
    id: 'agency-rumah-gadang-films',
    name: 'Rumah Gadang Films',
    type: 'Production House',
    city: 'Padang',
  },
  {
    id: 'agency-minang-motion',
    name: 'Minang Motion',
    type: 'Animation Studio',
    city: 'Padang',
  },
  {
    id: 'agency-ngarai-pictures',
    name: 'Ngarai Pictures',
    type: 'Production House',
    city: 'Bukittinggi',
  },
  {
    id: 'agency-saiyo-studio',
    name: 'Saiyo Studio',
    type: 'Creative Agency',
    city: 'Bukittinggi',
  },
  {
    id: 'agency-harau-visual',
    name: 'Harau Visual',
    type: 'Post-Production House',
    city: 'Payakumbuh',
  },
  {
    id: 'agency-batang-arau-media',
    name: 'Batang Arau Media',
    type: 'Commercial Studio',
    city: 'Padang',
  },
];

const COLLECTIVES = [
  {
    id: 'collective-kolektif-layar-tancap',
    name: 'Kolektif Layar Tancap',
    city: 'Padang',
    focus: 'Open-air community screenings',
  },
  {
    id: 'collective-ruang-gambar',
    name: 'Ruang Gambar',
    city: 'Bukittinggi',
    focus: 'Illustration and comics',
  },
  {
    id: 'collective-sasaran-suara',
    name: 'Sasaran Suara',
    city: 'Padang',
    focus: 'Field recording and sound art',
  },
  {
    id: 'collective-jaringan-dokumenter-minang',
    name: 'Jaringan Dokumenter Minang',
    city: 'Payakumbuh',
    focus: 'Documentary practice and archives',
  },
  {
    id: 'collective-tiga-tungku',
    name: 'Tiga Tungku',
    city: 'Bukittinggi',
    focus: 'Cross-disciplinary residency',
  },
];

const PROJECTS = [
  { id: 'project-jejak-di-ngarai', title: 'Jejak di Ngarai', year: 2023, type: 'Film', agency: 'agency-rumah-gadang-films' },
  { id: 'project-surat-dari-padang', title: 'Surat dari Padang', year: 2022, type: 'Film', agency: 'agency-rumah-gadang-films' },
  { id: 'project-anak-rantau', title: 'Anak Rantau', year: 2024, type: 'Film', agency: 'agency-rumah-gadang-films' },
  { id: 'project-pantai-air-manis', title: 'Pantai Air Manis', year: 2023, type: 'Film', agency: 'agency-rumah-gadang-films' },
  { id: 'project-si-rusa-dan-kura', title: 'Si Rusa dan Kura', year: 2023, type: 'Animation', agency: 'agency-minang-motion' },
  { id: 'project-legenda-malin', title: 'Legenda Malin', year: 2024, type: 'Animation', agency: 'agency-minang-motion' },
  { id: 'project-negeri-di-atas-awan', title: 'Negeri di Atas Awan', year: 2022, type: 'Animation', agency: 'agency-minang-motion' },
  { id: 'project-randai-terakhir', title: 'Randai Terakhir', year: 2021, type: 'Documentary', agency: 'agency-ngarai-pictures' },
  { id: 'project-penjaga-hutan-mentawai', title: 'Penjaga Hutan Mentawai', year: 2023, type: 'Documentary', agency: 'agency-ngarai-pictures' },
  { id: 'project-jam-gadang-nights', title: 'Jam Gadang Nights', year: 2024, type: 'Music Video', agency: 'agency-ngarai-pictures' },
  { id: 'project-rendang-nusantara', title: 'Rendang Nusantara', year: 2022, type: 'Commercial', agency: 'agency-saiyo-studio' },
  { id: 'project-kopi-solok-radjo', title: 'Kopi Solok Radjo', year: 2023, type: 'Commercial', agency: 'agency-saiyo-studio' },
  { id: 'project-bank-nagari-digital', title: 'Bank Nagari Digital', year: 2023, type: 'Commercial', agency: 'agency-saiyo-studio' },
  { id: 'project-harau-echo', title: 'Harau Echo', year: 2024, type: 'Documentary', agency: 'agency-harau-visual' },
  { id: 'project-talempong-remix', title: 'Talempong Remix', year: 2024, type: 'Music Video', agency: 'agency-harau-visual' },
  { id: 'project-badai-di-teluk', title: 'Badai di Teluk', year: 2021, type: 'Music Video', agency: 'agency-harau-visual' },
  { id: 'project-semen-padang-90', title: 'Semen Padang 90', year: 2024, type: 'Commercial', agency: 'agency-batang-arau-media' },
  { id: 'project-lagu-untuk-bundo', title: 'Lagu untuk Bundo', year: 2022, type: 'Music Video', agency: 'agency-batang-arau-media' },
  { id: 'project-suara-pasar-raya', title: 'Suara Pasar Raya', year: 2024, type: 'Documentary', agency: 'agency-batang-arau-media' },
  { id: 'project-festival-tabuik', title: 'Festival Tabuik', year: 2022, type: 'Documentary', agency: 'agency-batang-arau-media' },
];

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

/** `(:Talent)-[:HAS_SKILL]->(:Skill)` */
const HAS_SKILL: Array<[string, string]> = [
  ['talent-rian-syahputra', 'skill-directing'],
  ['talent-rian-syahputra', 'skill-screenwriting'],
  ['talent-dita-anggraini', 'skill-directing'],
  ['talent-fajar-maulana', 'skill-cinematography'],
  ['talent-intan-suryani', 'skill-cinematography'],
  ['talent-intan-suryani', 'skill-colour-grading'],
  ['talent-bayu-pratama', 'skill-editing'],
  ['talent-lia-marlina', 'skill-editing'],
  ['talent-lia-marlina', 'skill-motion-graphics'],
  ['talent-arif-rahman', 'skill-colour-grading'],
  ['talent-yusra-hakim', 'skill-sound-design'],
  ['talent-nadia-sabri', 'skill-sound-design'],
  ['talent-elok-permata', 'skill-makeup-artistry'],
  ['talent-sari-wulandari', 'skill-makeup-artistry'],
  ['talent-sari-wulandari', 'skill-production-design'],
  ['talent-gilang-ramadhan', 'skill-2d-animation'],
  ['talent-mira-oktavia', 'skill-2d-animation'],
  ['talent-mira-oktavia', 'skill-motion-graphics'],
  ['talent-taufik-hidayat', 'skill-3d-modelling'],
  ['talent-rani-permatasari', 'skill-3d-modelling'],
  ['talent-rani-permatasari', 'skill-vfx-compositing'],
  ['talent-hendra-gunawan', 'skill-vfx-compositing'],
  ['talent-vina-anjani', 'skill-motion-graphics'],
  ['talent-doni-saputra', 'skill-motion-graphics'],
  ['talent-doni-saputra', 'skill-2d-animation'],
  ['talent-kiki-ananda', 'skill-screenwriting'],
  ['talent-reza-fadillah', 'skill-screenwriting'],
  ['talent-anisa-fitri', 'skill-production-design'],
  ['talent-oki-firdaus', 'skill-production-design'],
  ['talent-tia-rahmadani', 'skill-cinematography'],
  ['talent-surya-lesmana', 'skill-editing'],
  ['talent-melati-ningsih', 'skill-colour-grading'],
  ['talent-ihsan-fadli', 'skill-sound-design'],
  ['talent-wulan-safitri', 'skill-2d-animation'],
  ['talent-ade-kurniawan', 'skill-3d-modelling'],
  ['talent-nurul-hasanah', 'skill-makeup-artistry'],
  ['talent-bimo-arya', 'skill-directing'],
];

/**
 * `(:Talent)-[:MEMBER_OF]->(:Collective)`
 *
 * Yusra Hakim and Elok Permata share Tiga Tungku and nothing else — no skill,
 * no project, no second collective. That makes their shortest path exactly two
 * hops through a `Collective`, which is the demo case for Query B and the
 * concrete answer to "what does the graph model buy you here". It is verified
 * at the bottom of this file; do not add an edge that gives them a second
 * shared neighbour without updating that check.
 */
const MEMBER_OF: Array<[string, string]> = [
  ['talent-rian-syahputra', 'collective-kolektif-layar-tancap'],
  ['talent-bayu-pratama', 'collective-kolektif-layar-tancap'],
  ['talent-reza-fadillah', 'collective-kolektif-layar-tancap'],
  ['talent-sari-wulandari', 'collective-kolektif-layar-tancap'],
  ['talent-doni-saputra', 'collective-kolektif-layar-tancap'],
  ['talent-mira-oktavia', 'collective-ruang-gambar'],
  ['talent-elok-permata', 'collective-ruang-gambar'],
  ['talent-vina-anjani', 'collective-ruang-gambar'],
  ['talent-anisa-fitri', 'collective-ruang-gambar'],
  ['talent-yusra-hakim', 'collective-sasaran-suara'],
  ['talent-nadia-sabri', 'collective-sasaran-suara'],
  ['talent-ihsan-fadli', 'collective-sasaran-suara'],
  ['talent-lia-marlina', 'collective-jaringan-dokumenter-minang'],
  ['talent-tia-rahmadani', 'collective-jaringan-dokumenter-minang'],
  ['talent-kiki-ananda', 'collective-jaringan-dokumenter-minang'],
  ['talent-bimo-arya', 'collective-jaringan-dokumenter-minang'],
  ['talent-yusra-hakim', 'collective-tiga-tungku'],
  ['talent-elok-permata', 'collective-tiga-tungku'],
  ['talent-taufik-hidayat', 'collective-tiga-tungku'],
  ['talent-surya-lesmana', 'collective-tiga-tungku'],
];

/** `(:Talent)-[:COLLABORATED_ON {role}]->(:Project)` */
const COLLABORATED_ON: Array<[string, string, string]> = [
  ['talent-rian-syahputra', 'project-jejak-di-ngarai', 'Director'],
  ['talent-fajar-maulana', 'project-jejak-di-ngarai', 'Director of Photography'],
  ['talent-bayu-pratama', 'project-jejak-di-ngarai', 'Editor'],
  ['talent-sari-wulandari', 'project-jejak-di-ngarai', 'Makeup Artist'],
  ['talent-oki-firdaus', 'project-jejak-di-ngarai', 'Production Designer'],

  ['talent-dita-anggraini', 'project-surat-dari-padang', 'Director'],
  ['talent-intan-suryani', 'project-surat-dari-padang', 'Director of Photography'],
  ['talent-surya-lesmana', 'project-surat-dari-padang', 'Editor'],
  ['talent-nadia-sabri', 'project-surat-dari-padang', 'Sound Designer'],

  ['talent-rian-syahputra', 'project-anak-rantau', 'Director'],
  ['talent-intan-suryani', 'project-anak-rantau', 'Director of Photography'],
  ['talent-melati-ningsih', 'project-anak-rantau', 'Colourist'],
  ['talent-reza-fadillah', 'project-anak-rantau', 'Screenwriter'],
  ['talent-nurul-hasanah', 'project-anak-rantau', 'Makeup Artist'],

  ['talent-dita-anggraini', 'project-pantai-air-manis', 'Director'],
  ['talent-fajar-maulana', 'project-pantai-air-manis', 'Director of Photography'],
  ['talent-arif-rahman', 'project-pantai-air-manis', 'Colourist'],
  ['talent-anisa-fitri', 'project-pantai-air-manis', 'Production Designer'],

  ['talent-gilang-ramadhan', 'project-si-rusa-dan-kura', 'Lead Animator'],
  ['talent-mira-oktavia', 'project-si-rusa-dan-kura', 'Animator'],
  ['talent-taufik-hidayat', 'project-si-rusa-dan-kura', '3D Artist'],
  ['talent-nadia-sabri', 'project-si-rusa-dan-kura', 'Sound Designer'],

  ['talent-gilang-ramadhan', 'project-legenda-malin', 'Lead Animator'],
  ['talent-wulan-safitri', 'project-legenda-malin', 'Animator'],
  ['talent-ade-kurniawan', 'project-legenda-malin', '3D Artist'],
  ['talent-rani-permatasari', 'project-legenda-malin', 'Lighting Artist'],
  ['talent-ihsan-fadli', 'project-legenda-malin', 'Sound Designer'],

  ['talent-mira-oktavia', 'project-negeri-di-atas-awan', 'Animator'],
  ['talent-taufik-hidayat', 'project-negeri-di-atas-awan', '3D Artist'],
  ['talent-hendra-gunawan', 'project-negeri-di-atas-awan', 'VFX Artist'],
  ['talent-kiki-ananda', 'project-negeri-di-atas-awan', 'Screenwriter'],

  ['talent-dita-anggraini', 'project-randai-terakhir', 'Director'],
  ['talent-tia-rahmadani', 'project-randai-terakhir', 'Director of Photography'],
  ['talent-lia-marlina', 'project-randai-terakhir', 'Editor'],
  ['talent-elok-permata', 'project-randai-terakhir', 'Makeup Artist'],
  ['talent-ihsan-fadli', 'project-randai-terakhir', 'Location Sound'],

  ['talent-kiki-ananda', 'project-penjaga-hutan-mentawai', 'Screenwriter'],
  ['talent-tia-rahmadani', 'project-penjaga-hutan-mentawai', 'Director of Photography'],
  ['talent-lia-marlina', 'project-penjaga-hutan-mentawai', 'Editor'],
  ['talent-ihsan-fadli', 'project-penjaga-hutan-mentawai', 'Location Sound'],

  ['talent-vina-anjani', 'project-jam-gadang-nights', 'Motion Designer'],
  ['talent-elok-permata', 'project-jam-gadang-nights', 'Makeup Artist'],
  ['talent-surya-lesmana', 'project-jam-gadang-nights', 'Editor'],
  ['talent-intan-suryani', 'project-jam-gadang-nights', 'Director of Photography'],

  ['talent-doni-saputra', 'project-rendang-nusantara', 'Motion Designer'],
  ['talent-sari-wulandari', 'project-rendang-nusantara', 'Makeup Artist'],
  ['talent-oki-firdaus', 'project-rendang-nusantara', 'Production Designer'],
  ['talent-bayu-pratama', 'project-rendang-nusantara', 'Editor'],

  ['talent-vina-anjani', 'project-kopi-solok-radjo', 'Motion Designer'],
  ['talent-fajar-maulana', 'project-kopi-solok-radjo', 'Director of Photography'],
  ['talent-melati-ningsih', 'project-kopi-solok-radjo', 'Colourist'],
  ['talent-reza-fadillah', 'project-kopi-solok-radjo', 'Copywriter'],

  ['talent-doni-saputra', 'project-bank-nagari-digital', 'Motion Designer'],
  ['talent-hendra-gunawan', 'project-bank-nagari-digital', 'VFX Artist'],
  ['talent-surya-lesmana', 'project-bank-nagari-digital', 'Editor'],
  ['talent-anisa-fitri', 'project-bank-nagari-digital', 'Production Designer'],

  ['talent-yusra-hakim', 'project-harau-echo', 'Sound Designer'],
  ['talent-tia-rahmadani', 'project-harau-echo', 'Director of Photography'],
  ['talent-lia-marlina', 'project-harau-echo', 'Editor'],
  ['talent-arif-rahman', 'project-harau-echo', 'Colourist'],

  ['talent-yusra-hakim', 'project-talempong-remix', 'Sound Designer'],
  ['talent-wulan-safitri', 'project-talempong-remix', 'Animator'],
  ['talent-rani-permatasari', 'project-talempong-remix', '3D Artist'],
  ['talent-melati-ningsih', 'project-talempong-remix', 'Colourist'],

  ['talent-hendra-gunawan', 'project-badai-di-teluk', 'VFX Artist'],
  ['talent-arif-rahman', 'project-badai-di-teluk', 'Colourist'],
  ['talent-doni-saputra', 'project-badai-di-teluk', 'Motion Designer'],
  ['talent-nurul-hasanah', 'project-badai-di-teluk', 'Makeup Artist'],

  ['talent-fajar-maulana', 'project-semen-padang-90', 'Director of Photography'],
  ['talent-bayu-pratama', 'project-semen-padang-90', 'Editor'],
  ['talent-oki-firdaus', 'project-semen-padang-90', 'Production Designer'],
  ['talent-ade-kurniawan', 'project-semen-padang-90', '3D Artist'],

  ['talent-nadia-sabri', 'project-lagu-untuk-bundo', 'Sound Designer'],
  ['talent-mira-oktavia', 'project-lagu-untuk-bundo', 'Animator'],
  ['talent-sari-wulandari', 'project-lagu-untuk-bundo', 'Makeup Artist'],
  ['talent-rian-syahputra', 'project-lagu-untuk-bundo', 'Director'],

  ['talent-kiki-ananda', 'project-suara-pasar-raya', 'Screenwriter'],
  ['talent-nurul-hasanah', 'project-suara-pasar-raya', 'Makeup Artist'],
  ['talent-ihsan-fadli', 'project-suara-pasar-raya', 'Location Sound'],
  ['talent-tia-rahmadani', 'project-suara-pasar-raya', 'Director of Photography'],

  ['talent-reza-fadillah', 'project-festival-tabuik', 'Screenwriter'],
  ['talent-anisa-fitri', 'project-festival-tabuik', 'Production Designer'],
  ['talent-wulan-safitri', 'project-festival-tabuik', 'Animator'],
  ['talent-arif-rahman', 'project-festival-tabuik', 'Colourist'],
];

// ---------------------------------------------------------------------------
// Write steps
// ---------------------------------------------------------------------------

/**
 * `tasks/001-seed-script.md` asks for a batched wipe via
 * `CALL { WITH n DETACH DELETE n } IN TRANSACTIONS OF 500 ROWS`. CognoDB's
 * parser does not accept it — `Neo.ClientError.Statement.SyntaxError:
 * unexpected token IN` — in an autocommit transaction or otherwise, so the
 * plain single-transaction delete the spec allows as a fallback is what we
 * use. See the `CALL {} IN TRANSACTIONS` probe in scripts/probe-cognodb.js.
 *
 * At 73 nodes this costs nothing. It is the constraint to revisit first if
 * the dataset ever grows past what a 256 MB instance can delete in one go.
 */
async function wipe(): Promise<string> {
  await writeQuery('MATCH (n) DETACH DELETE n');
  return 'single transaction (CognoDB rejects CALL {} IN TRANSACTIONS)';
}

async function applySchema(): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await writeQuery(statement);
  }
}

async function insertNodes(): Promise<void> {
  await writeQuery(
    `UNWIND $rows AS row
     MERGE (s:Skill { id: row.id })
     SET s.name = row.name, s.category = row.category`,
    { rows: SKILLS },
  );

  await writeQuery(
    `UNWIND $rows AS row
     MERGE (t:Talent { id: row.id })
     SET t.name = row.name, t.role = row.role, t.location = row.location, t.bio = row.bio`,
    { rows: TALENTS },
  );

  await writeQuery(
    `UNWIND $rows AS row
     MERGE (a:Agency { id: row.id })
     SET a.name = row.name, a.type = row.type, a.city = row.city`,
    { rows: AGENCIES },
  );

  await writeQuery(
    `UNWIND $rows AS row
     MERGE (c:Collective { id: row.id })
     SET c.name = row.name, c.city = row.city, c.focus = row.focus`,
    { rows: COLLECTIVES },
  );

  await writeQuery(
    `UNWIND $rows AS row
     MERGE (p:Project { id: row.id })
     SET p.title = row.title, p.year = row.year, p.type = row.type`,
    { rows: PROJECTS },
  );
}

async function insertRelationships(): Promise<void> {
  await writeQuery(
    `UNWIND $rows AS row
     MATCH (t:Talent { id: row.talentId })
     MATCH (s:Skill { id: row.skillId })
     MERGE (t)-[:HAS_SKILL]->(s)`,
    { rows: HAS_SKILL.map(([talentId, skillId]) => ({ talentId, skillId })) },
  );

  await writeQuery(
    `UNWIND $rows AS row
     MATCH (t:Talent { id: row.talentId })
     MATCH (c:Collective { id: row.collectiveId })
     MERGE (t)-[:MEMBER_OF]->(c)`,
    { rows: MEMBER_OF.map(([talentId, collectiveId]) => ({ talentId, collectiveId })) },
  );

  await writeQuery(
    `UNWIND $rows AS row
     MATCH (t:Talent { id: row.talentId })
     MATCH (p:Project { id: row.projectId })
     MERGE (t)-[r:COLLABORATED_ON]->(p)
     SET r.role = row.role`,
    {
      rows: COLLABORATED_ON.map(([talentId, projectId, role]) => ({ talentId, projectId, role })),
    },
  );

  await writeQuery(
    `UNWIND $rows AS row
     MATCH (p:Project { id: row.projectId })
     MATCH (a:Agency { id: row.agencyId })
     MERGE (p)-[:PRODUCED_BY]->(a)`,
    { rows: PROJECTS.map((p) => ({ projectId: p.id, agencyId: p.agency })) },
  );
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * The verification below runs the app's own queries, imported rather than
 * copied. A pasted copy would keep passing here after the real one changed,
 * which is the exact failure this step exists to catch.
 */
const QUERY_A = RECOMMENDATIONS_QUERY;
const QUERY_B = PATH_QUERY;

type PathNode = { id: string; label: string; name: string };
type PathRow = { degrees: number; pathNodes: PathNode[]; pathTypes: string[] };

const failures: string[] = [];

function check(name: string, ok: boolean, detail: string): void {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures.push(`${name}: ${detail}`);
}

function renderPath(row: PathRow): string {
  return row.pathNodes
    .map((node, i) => (i === 0 ? node.name : `-[${row.pathTypes[i - 1]}]- ${node.name}`))
    .join(' ');
}

async function verify(): Promise<void> {
  // Query A has to return something, or the recommendation feature demos an
  // empty list. Rian and Arif have never worked together; Rumah Gadang Films
  // produced both of their films, which is the whole point of the query.
  const recommendations = await readQuery(QUERY_A, {
    talentId: 'talent-rian-syahputra',
    skill: 'Colour Grading',
  });
  check(
    'Query A returns recommendations',
    recommendations.length > 0,
    recommendations.length > 0
      ? `${recommendations.length} for Rian Syahputra + Colour Grading, first via ${recommendations[0].viaAgency}`
      : 'no rows for Rian Syahputra + Colour Grading',
  );

  // The headline case for the graph argument: two talents with no shared
  // credit, no shared skill, and no shared agency, one introduction apart
  // through a collective.
  const viaCollective = await readQuery<PathRow>(QUERY_B, {
    fromId: 'talent-yusra-hakim',
    toId: 'talent-elok-permata',
  });
  const collectiveHop = viaCollective[0];
  check(
    'Query B routes Yusra to Elok through a Collective',
    collectiveHop?.degrees === 2 &&
      collectiveHop.pathNodes.some((node) => node.label === 'Collective'),
    collectiveHop ? `${collectiveHop.degrees} hops: ${renderPath(collectiveHop)}` : 'no path found',
  );

  // The same query at depth. Bimo has no credits yet, so every route out of
  // him starts at his collective — which is exactly how a newcomer is
  // reachable at all.
  const deepPath = await readQuery<PathRow>(QUERY_B, {
    fromId: 'talent-bimo-arya',
    toId: 'talent-yusra-hakim',
  });
  const deep = deepPath[0];
  check(
    'Query B finds a 4-hop path crossing a Collective',
    deep?.degrees === 4 && deep.pathNodes.some((node) => node.label === 'Collective'),
    deep ? `${deep.degrees} hops: ${renderPath(deep)}` : 'no path found',
  );

  const isolated = await readQuery<{ name: string }>(
    `MATCH (t:Talent) WHERE NOT (t)--() RETURN t.name AS name ORDER BY name`,
  );
  check(
    'No isolated Talent',
    isolated.length === 0,
    isolated.length === 0 ? 'every talent has at least one edge' : isolated.map((r) => r.name).join(', '),
  );

  // The landing page's one-click chips are a hand-picked list of ids. Two of
  // them once shipped pointing at nodes this script had never written, so every
  // click on the public demo opened a modal reading "Unable to load
  // connections". Resolving them here is what stops that recurring: the seed
  // fails rather than the homepage.
  const featured = await readQuery<{ id: string; label: string }>(
    `MATCH (n) WHERE n.id IN $ids RETURN n.id AS id, labels(n)[0] AS label`,
    { ids: FEATURED_ENTITIES.map((entity) => entity.id) },
  );
  const foundLabel = new Map(featured.map((row) => [row.id, row.label]));
  const mismatched = FEATURED_ENTITIES.filter(
    (entity) => foundLabel.get(entity.id) !== entity.label,
  );
  check(
    'Featured entities resolve',
    mismatched.length === 0,
    mismatched.length === 0
      ? `all ${FEATURED_ENTITIES.length} landing-page chips resolve to their declared label`
      : mismatched
          .map((e) => `${e.id} expected ${e.label}, got ${foundLabel.get(e.id) ?? 'no such node'}`)
          .join('; '),
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const LABELS = ['Talent', 'Skill', 'Project', 'Agency', 'Collective'] as const;

/**
 * Counted one label at a time. Labels cannot be parameterised in Cypher, and
 * the project rules forbid building the query by concatenation, so each label
 * gets its own fixed query string — the same lookup-table discipline as
 * docs/database.md §2.4.
 */
const COUNT_BY_LABEL: Record<(typeof LABELS)[number], string> = {
  Talent: 'MATCH (n:Talent) RETURN count(n) AS total',
  Skill: 'MATCH (n:Skill) RETURN count(n) AS total',
  Project: 'MATCH (n:Project) RETURN count(n) AS total',
  Agency: 'MATCH (n:Agency) RETURN count(n) AS total',
  Collective: 'MATCH (n:Collective) RETURN count(n) AS total',
};

async function summarise(): Promise<void> {
  let nodeTotal = 0;
  for (const label of LABELS) {
    const [row] = await readQuery<{ total: number }>(COUNT_BY_LABEL[label]);
    nodeTotal += row.total;
    console.log(`  ${String(row.total).padStart(3)}  ${label}`);
  }

  const [edges] = await readQuery<{ total: number }>(
    'MATCH ()-[r]->() RETURN count(r) AS total',
  );
  console.log(`  ${String(nodeTotal).padStart(3)}  nodes total`);
  console.log(`  ${String(edges.total).padStart(3)}  relationships`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('\nWiping existing data');
  console.log(`  ${await wipe()}`);

  console.log('\nApplying constraints and indexes');
  await applySchema();
  console.log(`  ${SCHEMA_STATEMENTS.length} statements applied`);

  console.log('\nInserting nodes');
  await insertNodes();

  console.log('\nInserting relationships');
  await insertRelationships();

  console.log('\nVerifying the demo queries');
  await verify();

  console.log('\nSeeded');
  await summarise();
}

let exitCode = 0;
try {
  await main();
  if (failures.length > 0) {
    console.error(`\n${failures.length} verification check(s) failed:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error('\nThe data is in the database but does not support the demo queries.');
    exitCode = 1;
  } else {
    console.log('\nAll verification checks passed.\n');
  }
} catch (error) {
  if (error instanceof DatabaseConfigError) {
    console.error(`\n${error.message}`);
  } else if (error instanceof DatabaseUnavailableError) {
    console.error(`\nCould not reach CognoDB (${error.code}). Check COGNODB_URL and that the instance is running.`);
  } else {
    console.error('\nSeed failed:', error instanceof Error ? error.message : String(error));
  }
  exitCode = 1;
} finally {
  await closeDriver();
}

process.exit(exitCode);
