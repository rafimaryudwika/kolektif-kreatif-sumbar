// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import vercel from '@astrojs/vercel';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Every route in this app reads from CognoDB at request time, so there is
  // nothing worth prerendering. Individual static pages can still opt in with
  // `export const prerender = true`.
  output: 'server',

  adapter: vercel(),
  integrations: [svelte()],

  // Self-hosted so the UI never waits on a third-party font CDN. Astro emits
  // the preload links and fallback metrics for us.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Inter',
      cssVariable: '--font-inter',
      weights: [400, 500, 600, 700],
      styles: ['normal'],
      subsets: ['latin'],
    },
  ],

  vite: {
    plugins: [tailwindcss()]
  }
});
