import type { ComponentChildren } from 'preact';
import './Card.css';

interface Props {
  label?: string;
  tone?: 'paper' | 'dark';
  children: ComponentChildren;
  class?: string;
}

export function Card({ label, tone = 'paper', children, class: cls }: Props) {
  const classes = ['card', `card--${tone}`, cls ?? ''].filter(Boolean).join(' ');
  return (
    <section class={classes}>
      {label ? <span class="card__label mono-sm">{label}</span> : null}
      <div class="card__body">{children}</div>
    </section>
  );
}
