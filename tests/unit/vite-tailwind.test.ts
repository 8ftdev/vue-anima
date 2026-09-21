import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { animaTailwind } from '../../src/plugins/vite-tailwind';

async function manifestFor(source: string): Promise<Record<string, string[]>> {
  const plugin = animaTailwind({ css: 'tests/fixtures/colors.css' });
  const context = {
    addWatchFile(path: string): void {
      expect(path).toBeTruthy();
    },
    error(message: string): never {
      throw new Error(message);
    },
  };
  const transform = plugin.transform;
  const load = plugin.load;
  if (typeof transform !== 'function' || typeof load !== 'function')
    throw new TypeError('Expected Vite hooks');
  await transform.call(context as never, source, 'Component.vue');
  const code = (await load.call(
    context as never,
    '\0virtual:vue-anima/tailwind',
  )) as string;
  const module: unknown = await import(
    `data:text/javascript,${encodeURIComponent(code)}`
  );
  return (module as { default: Record<string, string[]> }).default;
}

test('Vite integration extracts static anima classes through the project Tailwind theme', async () => {
  const source = await readFile('tests/fixtures/StaticTailwind.vue', 'utf8');
  const manifest = await manifestFor(source);
  expect(manifest['bg-blue-300']).toContain('background-color');
  expect(manifest['w-[123px]']).toContain('width');
  expect(manifest['opacity-50']).toContain('opacity');
  expect(manifest['sm:bg-red-200']).toContain('background-color');
  expect(manifest['not-a-tailwind-class']).toBeUndefined();
});

test('Vite integration rejects a static class the Tailwind theme cannot compile', async () => {
  const invalid = manifestFor(
    '<template><div v-anima="\'not-a-tailwind-class\'" /></template>',
  );
  await invalid.then(
    () => {
      throw new Error('Expected static check to reject invalid class');
    },
    (error: unknown) => {
      expect(String(error)).toContain('Tailwind cannot compile class');
    },
  );
});

test('Vite integration rejects invalid utilities under a valid Tailwind variant', async () => {
  const invalid = manifestFor(
    '<template><div v-anima="\'hover:not-a-tailwind-class\'" /></template>',
  );
  await invalid.then(
    () => {
      throw new Error('Expected static check to reject invalid variant class');
    },
    (error: unknown) => {
      expect(String(error)).toContain('Tailwind cannot compile class');
    },
  );
});

test('Vite integration rejects invalid classes even when the same goal contains a valid variant', async () => {
  const invalid = manifestFor(
    '<template><div v-anima="\'not-a-tailwind-class hover:bg-blue-300\'" /></template>',
  );
  await invalid.then(
    () => {
      throw new Error('Expected mixed static goal to reject invalid class');
    },
    (error: unknown) => {
      expect(String(error)).toContain('not-a-tailwind-class');
    },
  );
});

test('Vite integration watches imported Tailwind CSS and propagates its manifest through HMR', async () => {
  const plugin = animaTailwind({ css: 'tests/fixtures/tailwind-entry.css' });
  const watched: string[] = [];
  const transform = plugin.transform;
  const hotUpdate = plugin.handleHotUpdate;
  if (typeof transform !== 'function' || typeof hotUpdate !== 'function')
    throw new TypeError('Expected Vite hooks');
  await transform.call(
    {
      addWatchFile(path: string): void {
        watched.push(path);
      },
      error(message: string): never {
        throw new Error(message);
      },
    } as never,
    '<template><div v-anima="\'bg-anima-custom\'" /></template>',
    'Component.vue',
  );
  const imported = watched.find((path) => path.endsWith('tailwind-config.css'));
  expect(imported).toBeDefined();
  const module = { id: '\0virtual:vue-anima/tailwind' };
  let invalidated = false;
  const updated = hotUpdate.call(
    plugin as never,
    {
      file: imported,
      modules: [],
      server: {
        moduleGraph: {
          getModuleById(): typeof module {
            return module;
          },
          invalidateModule(): void {
            invalidated = true;
          },
        },
      },
    } as never,
  );
  expect(invalidated).toBe(true);
  expect(updated as unknown[]).toContain(module);
});

test('Vite manifest removes candidates deleted from a Vue component', async () => {
  const plugin = animaTailwind({ css: 'tests/fixtures/colors.css' });
  const transform = plugin.transform;
  const load = plugin.load;
  if (typeof transform !== 'function' || typeof load !== 'function')
    throw new TypeError('Expected Vite hooks');
  const context = {
    addWatchFile(path: string): void {
      expect(path).toBeTruthy();
    },
    error(message: string): never {
      throw new Error(message);
    },
  };
  await transform.call(
    context as never,
    '<template><div v-anima="\'bg-blue-300\'" /></template>',
    'Component.vue',
  );
  await transform.call(
    context as never,
    '<template><div /></template>',
    'Component.vue',
  );
  const code = (await load.call(
    context as never,
    '\0virtual:vue-anima/tailwind',
  )) as string;
  const module: unknown = await import(
    `data:text/javascript,${encodeURIComponent(code)}`
  );
  expect(
    (module as { default: Record<string, string[]> }).default['bg-blue-300'],
  ).toBeUndefined();
});
