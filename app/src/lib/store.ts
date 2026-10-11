import { signal, effect } from '@preact/signals';
import { ACHURA_DEFAULTS, BEEF_DEFAULTS } from './cuts';
import type { Appetite, FuelId, Screen, TempUnit, Unit } from './types';

interface State {
  screen: Screen;
  people: number;
  kids: number;
  appetite: Appetite;
  unit: Unit;
  temp: TempUnit;
  selected: string[];
  fuel: FuelId;
  readyBy: string;
}

const KEY = 'asado.state.v1';

const DEFAULTS: State = {
  screen: 'landing',
  people: 8,
  kids: 0,
  appetite: 'normal',
  unit: 'kg',
  temp: 'c',
  selected: [...BEEF_DEFAULTS, ...ACHURA_DEFAULTS],
  fuel: 'charcoal',
  readyBy: '20:00',
};

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<State> & { achuras?: boolean };
    // v1 stored achuras as a bool and never put achura cuts in `selected`.
    // Carry it over: on means the classic achura spread is pre-picked.
    if (parsed.achuras === true) {
      parsed.selected = [...new Set([...(parsed.selected ?? []), ...ACHURA_DEFAULTS])];
    }
    delete parsed.achuras;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export const state = signal<State>(load());

effect(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state.value));
  } catch {
    /* storage unavailable — ignore */
  }
});

export function setScreen(screen: Screen) {
  state.value = { ...state.value, screen };
}

export function update(patch: Partial<State>) {
  state.value = { ...state.value, ...patch };
}

export function toggleCut(id: string) {
  const selected = state.value.selected.includes(id)
    ? state.value.selected.filter((c) => c !== id)
    : [...state.value.selected, id];
  state.value = { ...state.value, selected };
}

export const selectedCuts = () =>
  state.value.selected
    .map((id) => ({ id, on: state.value.selected.includes(id) }))
    .filter((c) => c.on);