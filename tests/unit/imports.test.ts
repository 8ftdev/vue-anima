import { expect, test } from 'bun:test';
import { createAnima, vAnima } from '../../src/index';
import { createAnima as createVaporAnima } from '../../src/vapor';
import { classGoals } from '../../src/plugins/classes';

test('entry points can be imported and configured without a browser', () => {
  expect(typeof document).toBe('undefined');
  expect(typeof vAnima.mounted).toBe('function');
  expect(typeof createAnima({ duration: 100 }).updated).toBe('function');
  expect(typeof createVaporAnima()).toBe('function');
  expect(typeof classGoals()).toBe('function');
});
