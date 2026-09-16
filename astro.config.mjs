// @ts-check

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel({
    // Prisma's WASM query compiler (engineType "client" in schema.prisma)
    // is loaded via a dynamic require() that Vercel's file tracer can't
    // follow, so it gets dropped from the function bundle unless listed
    // here explicitly. Without this, every Prisma query 500s in production
    // with "ENOENT ... query_compiler_bg.wasm".
    includeFiles: [
      './node_modules/.prisma/client/query_compiler_bg.wasm',
      './node_modules/.prisma/client/query_compiler_bg.js',
    ],
  }),
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react()],
});
