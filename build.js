#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */

const fs = require('fs');
const esbuild = require('esbuild');

const common = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: 'external',
};

esbuild
  .build({
    ...common,
    outdir: 'lib/esm',
    format: 'esm',
    packages: 'external',
  })
  .then(() => {
    const packageJson = JSON.stringify({ type: 'module' });
    fs.writeFileSync(`${__dirname}/lib/esm/package.json`, packageJson, 'utf8');

    console.log('esm build success.');
  });

esbuild
  .build({
    ...common,
    outdir: 'lib/cjs',
    format: 'cjs',
    packages: 'external',
  })
  .then(() => console.log('cjs build success.'));

esbuild
  .build({
    ...common,
    outfile: 'lib/plebai.bundle.js',
    format: 'iife',
    globalName: 'plebai',
    define: {
      window: 'self',
      global: 'self',
      process: '{"env": {}}',
    },
  })
  .then(() => console.log('standalone build success.'));
