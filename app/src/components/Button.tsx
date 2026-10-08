import type { JSX } from 'preact';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'danger';

interface Props extends JSX.HTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

export function Button({
  variant = 'primary',
  block = false,
  class: cls,
  type = 'button',
  ...rest
}: Props) {
  const classes = ['btn', `btn--${variant}`, block ? 'btn--block' : '', cls ?? '']
    .filter(Boolean)
    .join(' ');
  return <button type={type} class={classes} {...rest} />;
}
