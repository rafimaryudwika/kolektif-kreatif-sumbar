#!/usr/bin/env node
/**
 * CognoDB capability probe.
 *
 * Verifies connectivity and checks which Cypher features the managed instance
 * actually supports, before we commit application code to any of them.
 *
 * Everything it writes is confined to nodes labelled `_Probe` and is removed
 * again in the cleanup step, so it is safe to run against a seeded database.
 *
 * Usage: node scripts/probe-cognodb.js
 */

import 'dotenv/config';
import neo4j from 'neo4j-driver';

const { COGNODB_URL, COGNODB_USERNAME, COGNODB_PASSWORD } = process.env;

const missing = Object.entries({ COGNODB_URL, COGNODB_USERNAME, COGNODB_PASSWORD })
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in your CognoDB connection details.');
  process.exit(1);
}

const PASS = 'PASS';
const FAIL = 'FAIL';
const NA = 'N/A';
const results = [];

/**
 * Run one probe, record the outcome, never throw.
 *
 * `expectUnsupported: true` marks a feature this instance is already known not
 * to support and which the app codes around. A throw is recorded as N/A rather
 * than a failure, so the probe keeps documenting the gap without turning a
 * healthy run red.
 */
async function probe(name, fn, { expectUnsupported = false } = {}) {
  try {
    const detail = await fn();
    results.push({ name, status: PASS, detail: detail ?? '' });
    console.log(`  ${PASS}  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    const detail = `${error.code ?? error.name}: ${error.message.split('\n')[0]}`;
    const status = expectUnsupported ? NA : FAIL;
    results.push({ name, status, detail });
    console.log(`  ${status.padEnd(4)} ${name} — ${detail}`);
  }
}

const driver = neo4j.driver(
  COGNODB_URL,
  neo4j.auth.basic(COGNODB_USERNAME, COGNODB_PASSWORD),
);

/** Read helper: returns the raw record array. */
async function read(cypher, params = {}) {
  const session = driver.session();
  try {
    const result = await session.executeRead((tx) => tx.run(cypher, params));
    return result.records;
  } finally {
    await session.close();
  }
}

/** Write helper: returns the raw record array. */
async function write(cypher, params = {}) {
  const session = driver.session();
  try {
    const result = await session.executeWrite((tx) => tx.run(cypher, params));
    return result.records;
  } finally {
    await session.close();
  }
}

async function main() {
  console.log(`\nProbing ${COGNODB_URL} as "${COGNODB_USERNAME}"\n`);

  console.log('Connectivity');
  await probe('driver.getServerInfo()', async () => {
    const info = await driver.getServerInfo();
    return `agent=${info.agent} protocol=${info.protocolVersion} address=${info.address}`;
  });

  console.log('\nBasics');
  await probe('trivial read', async () => {
    const records = await read('RETURN 1 AS ok');
    return `ok=${records[0].get('ok')}`;
  });

  await probe('parameterised query', async () => {
    const records = await read('RETURN $value AS echo', { value: 'sumbar' });
    return `echo=${records[0].get('echo')}`;
  });

  // Expected to be absent: CognoDB is a hosted openCypher service, not a full
  // Neo4j deployment, so the admin procedures are not registered. Version info
  // comes from `driver.getServerInfo()` above instead.
  await probe(
    'server components',
    async () => {
      const records = await read('CALL dbms.components() YIELD name, versions, edition');
      return records
        .map((r) => `${r.get('name')} ${r.get('versions').join(',')} (${r.get('edition')})`)
        .join('; ');
    },
    { expectUnsupported: true },
  );

  await probe('db.labels() introspection', async () => {
    const records = await read('CALL db.labels() YIELD label RETURN label');
    const labels = records.map((r) => r.get('label'));
    return labels.length > 0 ? labels.join(', ') : '(no labels yet)';
  });

  await probe('existing data volume', async () => {
    const nodes = await read('MATCH (n) RETURN count(n) AS c');
    const rels = await read('MATCH ()-[r]->() RETURN count(r) AS c');
    return `${nodes[0].get('c')} nodes, ${rels[0].get('c')} relationships`;
  });

  console.log('\nSchema management');
  await probe('CREATE CONSTRAINT ... IF NOT EXISTS', () =>
    write(
      'CREATE CONSTRAINT probe_unique_id IF NOT EXISTS FOR (p:_Probe) REQUIRE p.id IS UNIQUE',
    ).then(() => 'unique constraint accepted'),
  );

  await probe('CREATE INDEX ... IF NOT EXISTS', () =>
    write('CREATE INDEX probe_name IF NOT EXISTS FOR (p:_Probe) ON (p.name)').then(
      () => 'index accepted',
    ),
  );

  console.log('\nWrite path');
  // Chain: a -> b -> c -> d, plus a long way round a -> e -> f -> g -> d.
  await probe('UNWIND + MERGE (idempotent seed)', async () => {
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({
      id,
      name: `Probe ${id.toUpperCase()}`,
    }));
    await write(
      `UNWIND $nodes AS row
       MERGE (p:_Probe { id: row.id })
       SET p.name = row.name`,
      { nodes },
    );
    const edges = [
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
      ['a', 'e'],
      ['e', 'f'],
      ['f', 'g'],
      ['g', 'd'],
    ].map(([from, to]) => ({ from, to }));
    await write(
      `UNWIND $edges AS row
       MATCH (from:_Probe { id: row.from })
       MATCH (to:_Probe { id: row.to })
       MERGE (from)-[r:_PROBE_LINK]->(to)
       SET r.via = 'probe'`,
      { edges },
    );
    // Re-run to confirm MERGE does not duplicate.
    await write(
      `UNWIND $nodes AS row
       MERGE (p:_Probe { id: row.id })`,
      { nodes },
    );
    const counted = await read('MATCH (p:_Probe) RETURN count(p) AS c');
    return `${counted[0].get('c')} probe nodes after two MERGE passes (expected 7)`;
  });

  // Expected to FAIL on this instance: the parser rejects the clause outright
  // with a syntax error, not a transaction-context error. `scripts/seed.ts`
  // wipes in a single transaction because of this.
  await probe('CALL {} IN TRANSACTIONS (batched writes)', async () => {
    const session = driver.session();
    try {
      await session.run(
        'MATCH (p:_Probe) CALL { WITH p SET p.batched = true } IN TRANSACTIONS OF 500 ROWS',
      );
      return 'accepted';
    } finally {
      await session.close();
    }
  }, { expectUnsupported: true });

  console.log('\nTraversal features');
  await probe('variable-length path [*..4]', async () => {
    const records = await read(
      `MATCH path = (a:_Probe { id: $from })-[:_PROBE_LINK*..4]->(b:_Probe { id: $to })
       RETURN count(path) AS c`,
      { from: 'a', to: 'd' },
    );
    return `${records[0].get('c')} paths a->d within 4 hops`;
  });

  await probe('shortestPath()', async () => {
    const records = await read(
      `MATCH (a:_Probe { id: $from }), (b:_Probe { id: $to })
       MATCH path = shortestPath((a)-[:_PROBE_LINK*..6]-(b))
       RETURN length(path) AS hops`,
      { from: 'a', to: 'd' },
    );
    return `shortest a->d = ${records[0].get('hops')} hops (expected 3)`;
  });

  await probe('allShortestPaths()', async () => {
    const records = await read(
      `MATCH (a:_Probe { id: $from }), (b:_Probe { id: $to })
       MATCH path = allShortestPaths((a)-[:_PROBE_LINK*..6]-(b))
       RETURN count(path) AS c`,
      { from: 'a', to: 'd' },
    );
    return `${records[0].get('c')} shortest paths`;
  });

  await probe('path deconstruction: nodes()/relationships()', async () => {
    const records = await read(
      `MATCH path = (a:_Probe { id: $from })-[:_PROBE_LINK*..4]->(b:_Probe { id: $to })
       RETURN [n IN nodes(path) | n.id] AS ids,
              size(relationships(path)) AS hops
       ORDER BY hops ASC LIMIT 1`,
      { from: 'a', to: 'd' },
    );
    return `${records[0].get('ids').join(' -> ')}`;
  });

  await probe('multi-hop fan-out (2 MATCH clauses, the Query A shape)', async () => {
    const records = await read(
      `MATCH (a:_Probe { id: $from })-[:_PROBE_LINK]->(hub:_Probe)
       MATCH (hub)-[:_PROBE_LINK]->(other:_Probe)
       WHERE a <> other
       RETURN DISTINCT other.id AS id ORDER BY id`,
      { from: 'a' },
    );
    return records.map((r) => r.get('id')).join(', ');
  });

  // Expected to FAIL on this instance, and the one probe here that returns a
  // wrong answer rather than an error: EXISTS() over a pattern does not read
  // the graph. Once both endpoints are bound it answers the same way for every
  // pair, so it must be checked against a pair that shares a neighbour *and* a
  // pair that does not. A single positive case would pass on a constant true
  // and prove nothing — an earlier version of this probe did exactly that and
  // reported the defect as fixed. Note the constant is `true` on this fixture
  // and `false` on the seeded graph for the same pattern, so neither answer
  // alone means anything. Query A needs this shape to express "people you have
  // never worked with" and uses COUNT {} instead, probed below. See
  // `docs/database.md` §3 Query A. A PASS here means EXISTS() is fixed.
  await probe(
    'EXISTS() over a pattern reads the graph',
    async () => {
      // `c` and `g` both point at `d`; `b` and `f` share nothing.
      const shared = await read(
        `MATCH (c:_Probe { id: 'c' }), (g:_Probe { id: 'g' })
         RETURN EXISTS((c)-[:_PROBE_LINK]->(:_Probe)<-[:_PROBE_LINK]-(g)) AS hit`,
      );
      const apart = await read(
        `MATCH (b:_Probe { id: 'b' }), (f:_Probe { id: 'f' })
         RETURN EXISTS((b)-[:_PROBE_LINK]->(:_Probe)<-[:_PROBE_LINK]-(f)) AS hit`,
      );
      const answers = `shared=${shared[0].get('hit')} apart=${apart[0].get('hit')}`;
      if (shared[0].get('hit') !== true || apart[0].get('hit') !== false) {
        throw new Error(`expected shared=true apart=false, got ${answers}`);
      }
      return answers;
    },
    { expectUnsupported: true },
  );

  await probe('COUNT {} distinguishes a shared neighbour from none', async () => {
    const shared = await read(
      `MATCH (c:_Probe { id: 'c' }), (g:_Probe { id: 'g' })
       RETURN COUNT { (c)-[:_PROBE_LINK]->(:_Probe)<-[:_PROBE_LINK]-(g) } AS n`,
    );
    const apart = await read(
      `MATCH (b:_Probe { id: 'b' }), (f:_Probe { id: 'f' })
       RETURN COUNT { (b)-[:_PROBE_LINK]->(:_Probe)<-[:_PROBE_LINK]-(f) } AS n`,
    );
    const answers = `shared=${shared[0].get('n')} apart=${apart[0].get('n')}`;
    if (Number(shared[0].get('n')) < 1 || Number(apart[0].get('n')) !== 0) {
      throw new Error(`expected shared>=1 apart=0, got ${answers}`);
    }
    return answers;
  });

  await probe('elementId()', async () => {
    const records = await read('MATCH (p:_Probe { id: $id }) RETURN elementId(p) AS eid', {
      id: 'a',
    });
    return String(records[0].get('eid'));
  });

  await probe('COUNT {} subquery', async () => {
    const records = await read(
      `MATCH (p:_Probe { id: $id })
       RETURN COUNT { (p)-[:_PROBE_LINK]->(:_Probe) } AS degree`,
      { id: 'a' },
    );
    return `degree=${records[0].get('degree')}`;
  });

  await probe('collect() + aggregation', async () => {
    const records = await read(
      `MATCH (p:_Probe)-[:_PROBE_LINK]->(q:_Probe)
       RETURN p.id AS id, collect(q.id) AS targets
       ORDER BY id LIMIT 3`,
    );
    return records.map((r) => `${r.get('id')}:[${r.get('targets').join('|')}]`).join(' ');
  });

  console.log('\nError handling');
  await probe('invalid Cypher surfaces a typed error', async () => {
    try {
      await read('THIS IS NOT CYPHER');
    } catch (error) {
      return `caught ${error.code ?? error.name}`;
    }
    throw new Error('expected the invalid query to throw, but it succeeded');
  });

  console.log('\nCleanup');
  await probe('remove probe data', async () => {
    await write('MATCH (p:_Probe) DETACH DELETE p');
    await write('DROP CONSTRAINT probe_unique_id IF EXISTS').catch(() => {});
    await write('DROP INDEX probe_name IF EXISTS').catch(() => {});
    const records = await read('MATCH (p:_Probe) RETURN count(p) AS c');
    return `${records[0].get('c')} probe nodes remaining`;
  });

  const failed = results.filter((r) => r.status === FAIL);
  const expected = results.filter((r) => r.status === NA);
  const passed = results.length - failed.length - expected.length;
  console.log(
    `\n${passed}/${results.length} probes passed` +
      (expected.length > 0 ? `, ${expected.length} unsupported as expected.` : '.'),
  );
  if (expected.length > 0) {
    console.log('\nUnsupported, and the app already works around it:');
    for (const e of expected) console.log(`  - ${e.name}: ${e.detail}`);
  }
  if (failed.length > 0) {
    console.log('\nUnexpectedly unsupported or failing:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  }
  return failed.length;
}

let exitCode = 0;
try {
  exitCode = await main();
} catch (error) {
  console.error('\nProbe aborted:', error.message);
  exitCode = 1;
} finally {
  await driver.close();
}
process.exit(exitCode > 0 ? 1 : 0);
