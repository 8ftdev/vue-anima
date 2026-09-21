import { expect, test } from 'bun:test';
import { vAnima } from 'vue-anima';
import { vAnima as vapor } from 'vue-anima/vapor';
import { classGoals } from 'vue-anima/plugins/classes';

test('built package exports load without browser globals', () => {
  expect(typeof document).toBe('undefined');
  expect(typeof vAnima.updated).toBe('function');
  expect(typeof vapor).toBe('function');
  expect(typeof classGoals()).toBe('function');
});
