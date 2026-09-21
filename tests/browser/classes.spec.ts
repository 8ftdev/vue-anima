import { expect, test } from '@playwright/test';

test('optional resolver uses generated Tailwind color and restores the original class', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const result = await page.evaluate(async () => {
    const el = document.createElement('div');
    el.className = 'bg-red-200';
    document.body.append(el);
    const originalColor = getComputedStyle(el).backgroundColor;
    const target = document.createElement('div');
    target.className = 'bg-blue-300';
    document.body.append(target);
    const targetColor = getComputedStyle(target).backgroundColor;
    const c = window.createController(el, {
      resolvers: [window.classGoals()],
      duration: 100,
    });
    c.update('bg-blue-300', false);
    c.update('bg-blue-300', true);
    const a = el.getAnimations()[0];
    if (!a) throw new Error('Expected Tailwind animation');
    a.finish();
    await a.finished;
    const activeColor = getComputedStyle(el).backgroundColor;
    c.update('bg-blue-300', false);
    for (const reverse of el.getAnimations()) {
      reverse.finish();
      await reverse.finished;
    }
    return {
      originalColor,
      targetColor,
      activeColor,
      restoredColor: getComputedStyle(el).backgroundColor,
      classes: el.className,
      styles: el.getAttribute('style') ?? '',
    };
  });
  expect(result.originalColor).not.toBe(result.targetColor);
  expect(result.activeColor).toBe(result.targetColor);
  expect(result.restoredColor).toBe(result.originalColor);
  expect(result.classes).toBe('bg-red-200');
  expect(result.styles).toBe('');
});

test('resolves every changed computed property from a target class list', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const result = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'opacity-100 translate-x-0 rounded-none p-0';
    document.body.append(el);
    return window.classGoals()('opacity-50 translate-x-4 rounded-xl p-6', el);
  });
  expect(result?.opacity).toBe('0.5');
  expect(result?.translate).not.toBe('none');
  expect(result?.padding).not.toBe('0px');
  expect(result?.borderTopLeftRadius).not.toBe('0px');
});

test('resolves a target utility even when its value matches the element default', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const display = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'hidden';
    document.body.append(el);
    return window.classGoals()('block', el)?.display;
  });
  expect(display).toBe('block');
});

test('resolves inherited properties back to their target defaults', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const visibility = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'invisible';
    document.body.append(el);
    return window.classGoals()('block', el)?.visibility;
  });
  expect(visibility).toBe('visible');
});

test('resolves compiled arbitrary-value utilities', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const width = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'w-[80px]';
    document.body.append(el);
    return window.classGoals()('w-[123px]', el)?.width;
  });
  expect(width).toBe('123px');
});

test('class resolution preserves inline styles and rejects missing utilities', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const result = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'bg-red-200';
    el.style.cssText = 'background: red; transition: all 1s; color: blue';
    document.body.append(el);
    const before = el.getAttribute('style');
    const resolve = window.classGoals();
    const goal = resolve('bg-blue-300', el);
    let rejected = false;
    try {
      resolve('class-that-tailwind-did-not-compile', el);
    } catch {
      rejected = true;
    }
    return {
      before,
      after: el.getAttribute('style'),
      classes: el.className,
      color: goal?.backgroundColor,
      rejected,
    };
  });
  expect(result.after).toBe(result.before);
  expect(result.classes).toBe('bg-red-200');
  expect(result.color).toBeTruthy();
  expect(result.rejected).toBe(true);
});

test('resolves a new class goal independently of the currently running animation', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const result = await page.evaluate(async () => {
    const el = document.createElement('div');
    el.className = 'bg-red-200';
    document.body.append(el);
    const original = getComputedStyle(el).backgroundColor;
    const c = window.createController(el, {
      resolvers: [window.classGoals()],
      duration: 100,
      easing: 'linear',
    });
    c.update('bg-blue-300', false);
    c.update('bg-blue-300', true);
    const first = el.getAnimations()[0];
    if (!first) throw new Error('Missing first animation');
    first.pause();
    first.currentTime = 50;
    c.update('bg-red-200', true);
    for (const a of el.getAnimations()) {
      a.finish();
      await a.finished;
    }
    return { original, current: getComputedStyle(el).backgroundColor };
  });
  expect(result.current).toBe(result.original);
});

test('keeps an identical active class goal after repeated updates', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const colors = await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent =
      '.repeat-source { background-color: red } .repeat-target { background-color: blue }';
    document.head.append(css);
    const el = document.createElement('div');
    el.className = 'repeat-source';
    document.body.append(el);
    const controller = window.createController(el, {
      resolvers: [window.classGoals()],
      duration: 0,
    });
    controller.update('repeat-target', true);
    const first = getComputedStyle(el).backgroundColor;
    controller.update('repeat-target', true);
    return { first, second: getComputedStyle(el).backgroundColor };
  });
  expect(colors.first).toBe('rgb(0, 0, 255)');
  expect(colors.second).toBe(colors.first);
});

test('does not turn content-dependent measurements into class goals', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const result = await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent =
      '.layout-source { display: none } .layout-target { display: block }';
    document.head.append(css);
    const el = document.createElement('div');
    el.className = 'layout-source';
    el.textContent = 'Content must keep its natural height';
    document.body.append(el);
    const controller = window.createController(el, {
      resolvers: [window.classGoals()],
      duration: 0,
    });
    controller.update('layout-target', true);
    return {
      display: getComputedStyle(el).display,
      height: el.getBoundingClientRect().height,
      inlineHeight: el.style.height,
      inlineWidth: el.style.width,
    };
  });
  expect(result.display).toBe('block');
  expect(result.height).toBeGreaterThan(0);
  expect(result.inlineHeight).toBe('');
  expect(result.inlineWidth).toBe('');
});

test('measures direct-child class selectors in their real parent context', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const opacity = await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent = '.direct-parent > .direct-target { opacity: .3 }';
    document.head.append(css);
    const parent = document.createElement('div');
    parent.className = 'direct-parent';
    const el = document.createElement('div');
    parent.append(el);
    document.body.append(parent);
    return window.classGoals()('direct-target', el)?.opacity;
  });
  expect(opacity).toBe('0.3');
});

test('reads class rules from adopted stylesheets', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const opacity = await page.evaluate(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('.adopted-target { opacity: .2 }');
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    try {
      const el = document.createElement('div');
      document.body.append(el);
      return window.classGoals()('adopted-target', el)?.opacity;
    } finally {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (candidate) => candidate !== sheet,
      );
    }
  });
  expect(opacity).toBe('0.2');
});

test('does not mistake class text inside an attribute selector for a class rule', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const rejected = await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent = '[data-label=".missing-target"] { opacity: .2 }';
    document.head.append(css);
    const el = document.createElement('div');
    document.body.append(el);
    try {
      window.classGoals()('missing-target', el);
      return false;
    } catch {
      return true;
    }
  });
  expect(rejected).toBe(true);
});

test('reads declarations from native nested class rules', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const opacity = await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent = '.nested-target { & { opacity: .3 } }';
    document.head.append(css);
    const el = document.createElement('div');
    document.body.append(el);
    return window.classGoals()('nested-target', el)?.opacity;
  });
  expect(opacity).toBe('0.3');
});

test('reads declarations inside active nested media rules', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const opacity = await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent =
      '.responsive-target { @media (min-width: 0px) { opacity: .3 } }';
    document.head.append(css);
    const el = document.createElement('div');
    document.body.append(el);
    return window.classGoals()('responsive-target', el)?.opacity;
  });
  expect(opacity).toBe('0.3');
});

test('reads class rules from accessible CSS imports', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const opacity = await page.evaluate(async () => {
    const url = URL.createObjectURL(
      new Blob(['.imported-target { opacity: .4 }'], { type: 'text/css' }),
    );
    const css = document.createElement('style');
    const loaded = new Promise<void>((resolve) => {
      css.addEventListener(
        'load',
        () => {
          resolve();
        },
        { once: true },
      );
    });
    css.textContent = `@import url("${url}");`;
    document.head.append(css);
    await loaded;
    try {
      const el = document.createElement('div');
      document.body.append(el);
      return window.classGoals()('imported-target', el)?.opacity;
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  expect(opacity).toBe('0.4');
});

test('measures percentage layout goals without competing with the source', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const width = await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent =
      '.flex-source { width: 100px } .flex-target { width: 100% }';
    document.head.append(css);
    const parent = document.createElement('div');
    parent.style.cssText = 'display:flex;width:300px';
    const el = document.createElement('div');
    el.className = 'flex-source';
    parent.append(el);
    document.body.append(parent);
    return window.classGoals()('flex-target', el)?.width;
  });
  expect(width).toBe('300px');
});

test('class measurement never changes form control state', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const checked = await page.evaluate(() => {
    const el = document.createElement('input');
    el.type = 'radio';
    el.name = 'group';
    el.checked = true;
    document.body.append(el);
    window.classGoals()('bg-blue-300', el);
    return el.checked;
  });
  expect(checked).toBe(true);
});

test('bg-current preserves the source element computed text color', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.classGoals === 'function');
  const result = await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent = '.bg-current { background-color: currentColor }';
    document.head.append(css);
    const el = document.createElement('div');
    el.style.color = 'blue';
    document.body.append(el);
    return window.classGoals()('bg-current', el)?.backgroundColor;
  });
  expect(result).toBe('rgb(0, 0, 255)');
});
