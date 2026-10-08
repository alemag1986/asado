import { useState } from 'preact/hooks';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { Stepper } from './Stepper';

let root: HTMLElement;

afterEach(() => {
  if (root) {
    act(() => render(null, root));
    root.remove();
  }
});

function Harness({ max }: { max: number }) {
  const [value, setValue] = useState(8);
  return (
    <Stepper label="People" value={value} onChange={setValue} min={1} max={max} />
  );
}

function mount(ui: Parameters<typeof render>[0]) {
  root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(ui, root));
  return root;
}

const readout = (el: HTMLElement) => el.querySelector('output')!.textContent;

test('increments and clamps at max', () => {
  const el = mount(<Harness max={9} />);
  const plus = el.querySelectorAll('button')[1];

  act(() => plus.click());
  expect(readout(el)).toContain('9');

  act(() => plus.click());
  expect(readout(el)).toContain('9');
  expect(plus.hasAttribute('disabled')).toBe(true);
});

test('disable decrement at min', () => {
  const el = mount(<Stepper label="People" value={1} onChange={() => {}} min={1} max={10} />);
  const minus = el.querySelectorAll('button')[0];
  expect(minus.hasAttribute('disabled')).toBe(true);
});
