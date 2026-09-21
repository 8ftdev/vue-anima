import { gzipSync } from 'node:zlib';
for (const [file, budget] of [
  ['index.js', 2048],
  ['vapor.js', 2048],
  ['plugins/classes.js', 1024],
] as const) {
  const bytes = await Bun.file(`dist/${file}`).bytes();
  const gzip = gzipSync(bytes).byteLength;
  console.log(
    `${file}: ${String(bytes.length)} bytes minified, ${String(gzip)} bytes gzip (budget ${String(budget)})`,
  );
  if (gzip > budget) throw new Error(`${file} exceeds its gzip budget`);
}
