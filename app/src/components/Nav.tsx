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
}

export function Nav({ items, activeId, onSelect }: Props) {
  return (
    <nav class="nav" aria-label="Steps">
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
