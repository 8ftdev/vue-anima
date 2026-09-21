import { rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: ['src/index.ts', 'src/vapor.ts', 'src/plugins/classes.ts'],
  root: 'src',
  outdir: 'dist',
  target: 'browser',
  format: 'esm',
  external: ['vue'],
  minify: true,
});
if (!result.success) throw new AggregateError(result.logs, 'Build failed');
