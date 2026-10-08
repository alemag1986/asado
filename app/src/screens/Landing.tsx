import { useState } from 'preact/hooks';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { MapSvg, type MapMarker } from '@/lib/map';
import { setScreen } from '@/lib/store';
import './Landing.css';

interface Style {
  id: string;
  region: string;
  style: string;
  fuel: string;
  span: string;
  blurb: string;
}

const STYLES: Style[] = [
  {
    id: 'cordoba',
    region: 'Sierras de Córdoba',
    style: 'Quebracho country',
    fuel: 'leña',
    span: 'slow start, long finish',
    blurb: 'The heartland. Thick quebracho splits burn down to a bed that feeds the rack all afternoon.',
  },
  {
    id: 'buenosaires',
    region: 'Buenos Aires',
    style: 'Parrilla porteña',
    fuel: 'carbón',
    span: 'every weekend',
    blurb: 'The classic: tira and achuras over a tight charcoal bed, beers in, feuds out.',
  },
  {
    id: 'uruguay',
    region: 'Uruguay',
    style: 'Parrilla a la leña',
    fuel: 'leña + carbón',
    span: 'all year',
    blurb: 'The stove-and-coal hybrid, open all winter. Chivito fills the weekdays.',
  },
  {
    id: 'patagonia',
    region: 'Patagonia',
    style: 'Cordero al asador',
    fuel: 'fire pit',
    span: 'half a day',
    blurb: 'Whole lamb on a cross, facing the wind, one rotation rule: patient.',
  },
  {
    id: 'norte',
    region: 'The North',
    style: 'Asado del monte',
    fuel: 'rama seca',
    span: 'quick and wild',
    blurb: 'Dry scrub-wood fires, fast and loud. The embers are hot, the meat moves.',
  },
];

const MARKERS: MapMarker[] = [
  { id: 'norte', col: 9, row: 7, color: 'var(--flame)' },
  { id: 'cordoba', col: 12, row: 8, color: 'var(--ember)' },
  { id: 'buenosaires', col: 16, row: 10, color: 'var(--carne)' },
  { id: 'uruguay', col: 21, row: 11, color: 'var(--yolk)' },
  { id: 'patagonia', col: 13, row: 17, color: 'var(--coal)' },
];

export function Landing() {
  const [selected, setSelected] = useState('cordoba');
  const style = STYLES.find((s) => s.id === selected)!;

  return (
    <div class="landing">
      <p class="mono-sm">asado.os // est. 1810</p>
      <h1 class="display">ASADO.</h1>
      <p class="term">system ready — meat, fire, smoke. tap a marker, then fire it up.</p>

      <div class="map-frame">
        <MapSvg markers={MARKERS} selectedId={selected} />
      </div>
      <div class="map-keys grid" role="presentation" aria-hidden="true">
        {MARKERS.map((m) => (
          <button
            key={m.id}
            type="button"
            class={`map-key${m.id === selected ? ' map-key--on' : ''}`}
            aria-label={`Select ${STYLES.find((s) => s.id === m.id)!.style}`}
            onClick={() => setSelected(m.id)}
          >
            <span class="map-key__sq" style={`background: ${m.color}`} />
            <span class="map-key__lbl">{m.id}</span>
          </button>
        ))}
      </div>

      <Card label="selected region" tone="dark" class="landing__style">
        <div class="landing__meta mono-sm">
          {style.region} · {style.span}
        </div>
        <h2 class="h2 landing__style-name">{style.style}</h2>
        <p class="term">{style.blurb}</p>
        <p class="mono-sm" style="color: var(--yolk); margin-top: var(--sp-3)">
          fuel: {style.fuel}
        </p>
      </Card>

      <div class="landing__cta">
        <Button block onClick={() => setScreen('meat')}>
          START THE ASADO
        </Button>
      </div>
    </div>
  );
}