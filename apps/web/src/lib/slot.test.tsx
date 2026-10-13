import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Sentence } from './slot.tsx';

const html = (message: (...slots: Array<string>) => string) =>
  render(
    <p>
      <Sentence message={message} slots={[<a key="a">A</a>, <b key="b">B</b>]} />
    </p>,
  ).container.innerHTML;

test('puts each slot where the message names it', () => {
  expect(html((a, b) => `x ${a} y ${b}.`)).toBe('<p>x <a>A</a> y <b>B</b>.</p>');
});

test('handles slots at the start and the end', () => {
  expect(html((a, b) => `${a} y ${b}`)).toBe('<p><a>A</a> y <b>B</b></p>');
});

test('places slots by their index, not their order in the message', () => {
  expect(html((a, b) => `${b} ${a}`)).toBe('<p><b>B</b> <a>A</a></p>');
});
