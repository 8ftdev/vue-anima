import { readFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { animaTailwind } from '../src/plugins/vite-tailwind';

interface Summary {
  samples: number;
  median: number;
  p95: number;
  mean: number;
}

function summarize(values: number[]): Summary {
  if (!values.length) throw new Error('No benchmark samples');
  const sorted = [...values].sort((left, right) => left - right);
  return {
    samples: values.length,
    median: sorted[Math.floor((sorted.length - 1) * 0.5)] ?? 0,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0,
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

function hooks(): {
  analyze: (source: string) => Promise<void>;
  manifest: () => Promise<string>;
} {
  const plugin = animaTailwind({ css: 'tests/fixtures/colors.css' });
  const transform = plugin.transform;
  const load = plugin.load;
  if (typeof transform !== 'function' || typeof load !== 'function')
    throw new TypeError('Vite plugin does not expose its transform/load hooks');
  const watched = new Set<string>();
  const context = {
    addWatchFile(path: string): void {
      watched.add(path);
    },
    error(message: string): never {
      throw new Error(message);
    },
  };
  return {
    async analyze(source: string): Promise<void> {
      await transform.call(context as never, source, 'Benchmark.vue');
    },
    async manifest(): Promise<string> {
      const result = await load.call(
        context as never,
        '\0virtual:vue-anima/tailwind',
      );
      if (typeof result !== 'string') throw new Error('Missing manifest');
      return result;
    },
  };
}

async function pluginBenchmarks(): Promise<{
  results: Record<string, Summary>;
  staticManifest: Record<string, string[]>;
}> {
  const source = await readFile('tests/fixtures/StaticTailwind.vue', 'utf8');
  const cold: number[] = [];
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const start = performance.now();
    const plugin = hooks();
    await plugin.analyze(source);
    const manifest = await plugin.manifest();
    if (!manifest.includes('bg-blue-300')) throw new Error('Empty manifest');
    cold.push(performance.now() - start);
  }

  const plugin = hooks();
  await plugin.analyze(source);
  await plugin.manifest();
  const transform: number[] = [];
  const manifest: number[] = [];
  for (let iteration = 0; iteration < 120; iteration += 1) {
    let start = performance.now();
    await plugin.analyze(source);
    transform.push(performance.now() - start);
    start = performance.now();
    await plugin.manifest();
    manifest.push(performance.now() - start);
  }
  const sourceCode = await plugin.manifest();
  const staticManifest = JSON.parse(
    sourceCode.slice('export default '.length, -1),
  ) as Record<string, string[]>;
  return {
    results: {
      'Vite fresh analyze + manifest': summarize(cold),
      'Vite warm SFC analyze': summarize(transform),
      'Vite warm manifest generation': summarize(manifest),
    },
    staticManifest,
  };
}

type RuntimeMode = 'dynamic class' | 'manifest class' | 'style object';

async function browserBenchmarks(
  url: string,
  staticManifest: Record<string, string[]>,
): Promise<{
  browserVersion: string;
  results: Record<RuntimeMode, Summary>;
}> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForFunction(
      () =>
        typeof window.createController === 'function' &&
        typeof window.classGoals === 'function',
    );
    const modes = ['dynamic class', 'manifest class', 'style object'] as const;
    const valuesByMode: Record<RuntimeMode, number[]> = {
      'dynamic class': [],
      'manifest class': [],
      'style object': [],
    };
    for (let round = 0; round < modes.length; round += 1) {
      for (let offset = 0; offset < modes.length; offset += 1) {
        const mode = modes[(round + offset) % modes.length];
        if (!mode) throw new Error('Missing benchmark mode');
        const values = await page.evaluate(
          ({ scenario, manifest }) => {
            const samples: number[] = [];
            const batchSize = 20;
            for (let batch = 0; batch < 50; batch += 1) {
              const prepared: {
                element: HTMLElement;
                controller: ReturnType<typeof window.createController>;
                goal: string | { opacity: number };
              }[] = [];
              for (let item = 0; item < batchSize; item += 1) {
                const element = document.createElement('div');
                element.className = 'bg-red-200';
                if (scenario === 'style object') element.style.opacity = '0';
                document.body.append(element);
                const resolver =
                  scenario === 'style object'
                    ? undefined
                    : window.classGoals(
                        scenario === 'manifest class' ? manifest : undefined,
                      );
                const controller = window.createController(element, {
                  ...(resolver ? { resolvers: [resolver] } : {}),
                  duration: 100,
                  easing: 'linear',
                });
                const goal =
                  scenario === 'style object' ? { opacity: 1 } : 'bg-blue-300';
                controller.update(goal, false);
                prepared.push({ element, controller, goal });
              }
              const start = performance.now();
              for (const { controller, goal } of prepared)
                controller.update(goal, true);
              const perAnimation = (performance.now() - start) / batchSize;
              if (!prepared[0]?.element.getAnimations().length)
                throw new Error(
                  `WAAPI animation was not created for ${scenario}`,
                );
              if (batch >= 10) samples.push(perAnimation);
              for (const { element, controller } of prepared) {
                controller.dispose();
                element.remove();
              }
            }
            return samples;
          },
          { scenario: mode, manifest: staticManifest },
        );
        valuesByMode[mode].push(...values);
      }
    }
    const results = {
      'dynamic class': summarize(valuesByMode['dynamic class']),
      'manifest class': summarize(valuesByMode['manifest class']),
      'style object': summarize(valuesByMode['style object']),
    };
    return { browserVersion: browser.version(), results };
  } finally {
    await browser.close();
  }
}

const plugin = await pluginBenchmarks();
const vite = await createServer({
  configFile: 'vite.config.ts',
  server: { host: '127.0.0.1', port: 0 },
});
try {
  await vite.listen();
  const url = vite.resolvedUrls?.local[0];
  if (!url) throw new Error('Vite did not provide a local URL');
  const { browserVersion, results } = await browserBenchmarks(
    url,
    plugin.staticManifest,
  );
  const rows = { ...plugin.results, ...results };
  console.log(
    `Bun ${Bun.version} | Chromium ${browserVersion} | ${platform()} ${release()} | ${cpus()[0]?.model ?? 'unknown CPU'}`,
  );
  console.log(
    'Browser rows are per animation, averaged over batches of 20 starts.',
  );
  console.log(
    'Scenario                          n   median ms    p95 ms   mean ms',
  );
  for (const [name, summary] of Object.entries(rows)) {
    console.log(
      `${name.padEnd(32)} ${String(summary.samples).padStart(3)} ${summary.median.toFixed(3).padStart(11)} ${summary.p95.toFixed(3).padStart(9)} ${summary.mean.toFixed(3).padStart(9)}`,
    );
  }
} finally {
  await vite.close();
}
