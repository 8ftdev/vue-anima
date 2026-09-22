import { expect, test } from 'bun:test';
import { createStagger } from '../../src/index';
import { createStagger as createVaporStagger } from '../../src/vapor';

test('shares a goal and offsets each item from the configured delay', () => {
  const options = {
    styles: { opacity: 1 },
    from: { opacity: 0 },
    duration: 300,
    delay: 20,
  };
  const reveal = createStagger(options, 35);

  expect(reveal(0)).toEqual({ ...options, delay: 20 });
  expect(reveal(1)).toEqual({ ...options, delay: 55 });
  expect(reveal(2)).toEqual({ ...options, delay: 90 });
  expect(options.delay).toBe(20);
  expect(createVaporStagger(options, 35)(2)).toEqual(reveal(2));
});

test('rejects invalid steps, indexes and resulting delays', () => {
  expect(() => createStagger({ styles: { opacity: 1 } }, -1)).toThrow(
    TypeError,
  );
  expect(() => createStagger({ styles: { opacity: 1 } }, Infinity)).toThrow(
    TypeError,
  );
  const reveal = createStagger({ styles: { opacity: 1 } }, 10);
  expect(() => reveal(-1)).toThrow(TypeError);
  expect(() => reveal(0.5)).toThrow(TypeError);
  expect(() => reveal(Infinity)).toThrow(TypeError);
  expect(() =>
    createStagger({ styles: { opacity: 1 }, delay: -1 }, 10)(0),
  ).toThrow(TypeError);
});
