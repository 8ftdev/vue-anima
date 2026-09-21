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

test('class resolution preserves inline styles and rejects unsupported utilities', async ({
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
      resolve('hover:bg-blue-300', el);
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
    css.textContent =
      '.source-text { color: blue } .bg-current { background-color: currentColor }';
    document.head.append(css);
    const el = document.createElement('div');
    el.className = 'source-text';
    document.body.append(el);
    return window.classGoals()('bg-current', el)?.backgroundColor;
  });
  expect(result).toBe('rgb(0, 0, 255)');
});
