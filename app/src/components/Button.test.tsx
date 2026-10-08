import { render } from 'preact';
import { expect, test, vi } from 'vitest';
import { Button } from './Button';

test('applies variant class and fires onClick', () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const onClick = vi.fn();
  render(<Button variant="danger" onClick={onClick}>Pull it</Button>, root);

  const btn = root.querySelector('button')!;
  expect(btn.className).toContain('btn--danger');
  expect(btn.getAttribute('type')).toBe('button');
  btn.click();
  expect(onClick).toHaveBeenCalledOnce();
});
