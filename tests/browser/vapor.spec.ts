import { expect, test } from '@playwright/test';

test('Vapor compiled template reacts to arguments, nested goals, and unmounts cleanly', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tests/fixtures/vapor.html');
  const el = page.locator('#vapor-target');
  await expect(el).toHaveCSS('opacity', '0');
  await page.getByText('Toggle Vapor', { exact: true }).click();
  await expect(el).toHaveCSS('opacity', '1');
  await page.getByText('Change Vapor goal', { exact: true }).click();
  await expect(el).toHaveCSS('opacity', '0.5');
  await page.getByText('Toggle Vapor', { exact: true }).click();
  await expect(el).toHaveCSS('opacity', '0');
  await page.getByText('Toggle Vapor', { exact: true }).click();
  const handle = await el.elementHandle();
  await page.getByText('Unmount Vapor', { exact: true }).click();
  expect(
    await handle.evaluate((node) => ({
      opacity: (node as HTMLElement).style.opacity,
      animations: node.getAnimations().length,
    })),
  ).toEqual({ opacity: '0', animations: 0 });
  expect(errors).toEqual([]);
});
