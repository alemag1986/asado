import './Nav.css';

export interface NavItem {
  id: string;
  step: string;
  label: string;
}

interface Props {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onHome?: () => void;
}

export function Nav({ items, activeId, onSelect, onHome }: Props) {
  return (
    <nav class="nav" aria-label="Navigation">
      {onHome ? (
        <button
          type="button"
          class="nav__cell nav__cell--home"
          aria-label="Back to the region map"
          onClick={onHome}
        >
          <span class="nav__step">MAP</span>
          <span class="nav__label">Region</span>
        </button>
      ) : null}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          class={`nav__cell${item.id === activeId ? ' nav__cell--on' : ''}`}
          aria-current={item.id === activeId ? 'page' : undefined}
          onClick={() => onSelect(item.id)}
        >
          <span class="nav__step">{item.step}</span>
          <span class="nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
