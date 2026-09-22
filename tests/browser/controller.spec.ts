import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => typeof window.createController === 'function',
  );
});

test('uses computed baseline, animates both ways and releases finished animations', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const el = document.createElement('div');
    el.style.cssText = 'opacity: 0.2; color: red';
    document.body.append(el);
    const c = window.createController(el, { duration: 100, easing: 'linear' });
    c.update({ opacity: 1 }, false);
    c.update({ opacity: 1 }, true);
    const a = el.getAnimations()[0];
    if (!a) throw new Error('Expected activation animation');
    a.pause();
    a.currentTime = 50;
    const middle = Number(getComputedStyle(el).opacity);
    a.finish();
    await a.finished;
    const active = el.style.opacity;
    c.update({ opacity: 1 }, false);
    const reverse = el.getAnimations()[0];
    if (!reverse) throw new Error('Expected deactivation animation');
    reverse.finish();
    await reverse.finished;
    return {
      middle,
      active,
      restored: el.style.opacity,
      color: el.style.color,
      animations: el.getAnimations().length,
    };
  });
  expect(result).toEqual({
    middle: 0.6,
    active: '1',
    restored: '0.2',
    color: 'red',
    animations: 0,
  });
});

test('interrupts at the rendered value and ignores equivalent updates', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.opacity = '0';
    document.body.append(el);
    const c = window.createController(el, { duration: 100, easing: 'linear' });
    c.update({ opacity: 1 }, false);
    c.update({ opacity: 1 }, true);
    const first = el.getAnimations()[0];
    if (!first) throw new Error('Missing animation');
    first.pause();
    first.currentTime = 40;
    c.update({ opacity: 1 }, true);
    const same = el.getAnimations()[0] === first;
    c.update({ opacity: 1 }, false);
    const reverse = el.getAnimations()[0];
    if (!reverse) throw new Error('Missing reverse animation');
    reverse.pause();
    reverse.currentTime = 0;
    return {
      same,
      opacity: Number(getComputedStyle(el).opacity),
      oldState: first.playState,
    };
  });
  expect(result.same).toBe(true);
  expect(result.opacity).toBeCloseTo(0.4);
  expect(result.oldState).toBe('idle');
});

test('restores removed goal properties and preserves original priority on disposal', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const el = document.createElement('div');
    el.style.cssText = 'opacity: 0.2 !important; color: red';
    document.body.append(el);
    const c = window.createController(el, { duration: 10 });
    c.update({ opacity: 1, color: 'blue' }, true);
    c.update({ color: 'green' }, true);
    for (const a of el.getAnimations()) {
      a.finish();
      await a.finished;
    }
    const restored = el.style.opacity;
    c.dispose();
    c.dispose();
    return {
      restored,
      priority: el.style.getPropertyPriority('opacity'),
      color: el.style.color,
      animations: el.getAnimations().length,
    };
  });
  expect(result).toEqual({
    restored: '0.2',
    priority: 'important',
    color: 'red',
    animations: 0,
  });
});

test('applies initial active goals immediately and parses CSS strings with zero values', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const el = document.createElement('div');
    document.body.append(el);
    const c = window.createController(el);
    c.update('opacity: 0; transform: translateX(10px)', true);
    const state = {
      opacity: el.style.opacity,
      transform: el.style.transform,
      count: el.getAnimations().length,
    };
    c.dispose();
    return { ...state, restored: el.style.cssText };
  });
  expect(result).toEqual({
    opacity: '0',
    transform: 'translateX(10px)',
    count: 0,
    restored: '',
  });
});

test('reduced motion applies goal without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const result = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.opacity = '0';
    document.body.append(el);
    const c = window.createController(el);
    c.update({ opacity: 1 }, false);
    c.update({ opacity: 1 }, true);
    return { opacity: el.style.opacity, count: el.getAnimations().length };
  });
  expect(result).toEqual({ opacity: '1', count: 0 });
});

test('missing WAAPI settles synchronously', async ({ page }) => {
  const result = await page.evaluate(() => {
    const el = document.createElement('div');
    document.body.append(el);
    Object.defineProperty(el, 'animate', { value: undefined });
    const c = window.createController(el);
    c.update({ opacity: 0 }, false);
    c.update({ opacity: 0 }, true);
    return el.style.opacity;
  });
  expect(result).toBe('0');
});

test('compiled Vue directive reacts when only its boolean argument changes', async ({
  page,
}) => {
  await expect(page.locator('#target')).toHaveCSS('opacity', '0');
  await page.getByRole('button', { name: 'Toggle', exact: true }).click();
  await expect(page.locator('#target')).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Toggle', exact: true }).click();
  await expect(page.locator('#target')).toHaveCSS('opacity', '0');
});

test('reads stylesheet defaults and restores the cascade after deactivation', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const style = document.createElement('style');
    style.textContent = '.baseline-test { opacity: 0.3 }';
    document.head.append(style);
    const el = document.createElement('div');
    el.className = 'baseline-test';
    document.body.append(el);
    const c = window.createController(el, { duration: 10 });
    c.update({ opacity: 1 }, false);
    c.update({ opacity: 1 }, true);
    for (const a of el.getAnimations()) {
      a.finish();
      await a.finished;
    }
    c.update({ opacity: 1 }, false);
    for (const a of el.getAnimations()) {
      a.finish();
      await a.finished;
    }
    const restored = getComputedStyle(el).opacity;
    style.textContent = '.baseline-test { opacity: 0.7 }';
    return {
      restored,
      inline: el.style.opacity,
      responsive: getComputedStyle(el).opacity,
    };
  });
  expect(result).toEqual({ restored: '0.3', inline: '', responsive: '0.7' });
});

test('a queued old completion cannot cancel a replacement animation', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const el = document.createElement('div');
    el.style.opacity = '0';
    document.body.append(el);
    const c = window.createController(el, { duration: 100 });
    c.update({ opacity: 1 }, false);
    c.update({ opacity: 1 }, true);
    const old = el.getAnimations()[0];
    if (!old) throw new Error('Missing first animation');
    old.finish();
    c.update({ opacity: 0.5 }, true);
    const replacement = el.getAnimations()[0];
    if (!replacement) throw new Error('Missing replacement');
    replacement.pause();
    await Promise.resolve();
    const running = replacement.playState;
    replacement.finish();
    await replacement.finished;
    return { running, opacity: el.style.opacity };
  });
  expect(result).toEqual({ running: 'paused', opacity: '0.5' });
});

test('invalid options do not corrupt an existing goal', async ({ page }) => {
  const result = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.opacity = '0';
    document.body.append(el);
    const c = window.createController(el);
    c.update({ opacity: 0.5 }, true);
    let rejected = false;
    try {
      c.update({ styles: { opacity: 1 }, duration: -1 }, true);
    } catch {
      rejected = true;
    }
    const opacity = el.style.opacity;
    c.dispose();
    return { rejected, opacity, restored: el.style.opacity };
  });
  expect(result).toEqual({ rejected: true, opacity: '0.5', restored: '0' });
});

for (const easing of ['initial', 'inherit', 'ease, linear', 'var(--timing)']) {
  test(`rejects non-WAAPI easing ${easing} before changing styles or canceling animation`, async ({
    page,
  }) => {
    const result = await page.evaluate((invalid) => {
      const el = document.createElement('div');
      el.style.opacity = '0';
      document.body.append(el);
      const c = window.createController(el, { duration: 100 });
      c.update({ opacity: 1 }, false);
      c.update({ opacity: 1 }, true);
      const animation = el.getAnimations()[0];
      if (!animation) throw new Error('Missing animation');
      animation.pause();
      animation.currentTime = 50;
      let rejected = false;
      try {
        c.update({ styles: { opacity: 0.5 }, easing: invalid }, true);
      } catch {
        rejected = true;
      }
      return {
        rejected,
        goal: el.style.opacity,
        state: animation.playState,
        same: el.getAnimations()[0] === animation,
      };
    }, easing);
    expect(result).toEqual({
      rejected: true,
      goal: '1',
      state: 'paused',
      same: true,
    });
  });
}

test('object activation works and an explicit argument takes precedence', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.opacity = '0';
    document.body.append(el);
    const c = window.createController(el, { duration: 0 });
    c.update({ styles: { opacity: 1 }, active: false });
    const initial = el.style.opacity;
    c.update({ styles: { opacity: 1 }, active: true });
    const active = el.style.opacity;
    c.update({ styles: { opacity: 1 }, active: true }, false);
    return { initial, active, overridden: el.style.opacity };
  });
  expect(result).toEqual({ initial: '0', active: '1', overridden: '0' });
});

test('shorthand goals restore pre-existing longhand values and priorities', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.cssText = 'margin-left: 7px !important; margin-right: 8px';
    document.body.append(el);
    const c = window.createController(el, { duration: 0 });
    c.update({ margin: '20px' }, true);
    c.dispose();
    return {
      left: el.style.marginLeft,
      right: el.style.marginRight,
      priority: el.style.getPropertyPriority('margin-left'),
      top: el.style.marginTop,
    };
  });
  expect(result).toEqual({
    left: '7px',
    right: '8px',
    priority: 'important',
    top: '',
  });
});

test('explicit from animates an initially active goal and then settles', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const c = window.createController(el, { duration: 100, easing: 'linear' });
    c.update({ styles: { opacity: 1 }, from: { opacity: 0 } }, true);
    const animation = el.getAnimations()[0];
    if (!animation) throw new Error('Missing mount animation');
    animation.pause();
    animation.currentTime = 0;
    const start = Number(getComputedStyle(el).opacity);
    animation.currentTime = 50;
    const middle = Number(getComputedStyle(el).opacity);
    animation.finish();
    await animation.finished;
    return {
      start,
      middle,
      end: el.style.opacity,
      animations: el.getAnimations().length,
    };
  });
  expect(result).toEqual({ start: 0, middle: 0.5, end: '1', animations: 0 });
});

test('reduced-motion opacity mode fades opacity while spatial styles settle immediately', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const result = await page.evaluate(async () => {
    const el = document.createElement('div');
    el.style.cssText = 'opacity: 0; transform: translateY(20px)';
    document.body.append(el);
    const c = window.createController(el, {
      duration: 500,
      easing: 'linear',
      reducedMotion: { opacityDuration: 100 },
    });
    c.update({ opacity: 1, transform: 'translateY(0px)' }, false);
    c.update({ opacity: 1, transform: 'translateY(0px)' }, true);
    const animation = el.getAnimations()[0];
    if (!animation) throw new Error('Missing opacity animation');
    animation.pause();
    animation.currentTime = 50;
    const middle = Number(getComputedStyle(el).opacity);
    const spatialAtMiddle = getComputedStyle(el).transform;
    animation.finish();
    await animation.finished;
    return {
      middle,
      spatialAtMiddle,
      spatialAtEnd: getComputedStyle(el).transform,
      end: el.style.opacity,
      animations: el.getAnimations().length,
    };
  });
  expect(result.middle).toBe(0.5);
  expect(result.spatialAtMiddle).toBe(result.spatialAtEnd);
  expect(result.end).toBe('1');
  expect(result.animations).toBe(0);
});
