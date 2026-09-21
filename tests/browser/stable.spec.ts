import { expect, test } from '@playwright/test';

test('Vue 3.5 compiled directive supports boolean arguments', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tests/fixtures/stable.html');
  await expect(page.locator('#stable-target')).toHaveCSS('opacity', '0');
  await page.getByText('Toggle stable').click();
  await expect(page.locator('#stable-target')).toHaveCSS('opacity', '1');
  await page.getByText('Toggle stable').click();
  await expect(page.locator('#stable-target')).toHaveCSS('opacity', '0');
  expect(errors).toEqual([]);
});
