import { useRef, useState } from 'preact/hooks';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Segmented } from '@/components/Segmented';
import { FUELS, CUT_MAP } from '@/lib/cuts';
import { buildFire } from '@/lib/fire';
import { fmtMinutes, fmtWeight } from '@/lib/format';
import { analyzeEmbers, type EmberCheck } from '@/lib/analyze';
import { downscale } from '@/lib/image';
import { buildPlan } from '@/lib/plan';
import { state, update, setScreen } from '@/lib/store';
import type { FuelId } from '@/lib/types';
import './Fire.css';

export function Fire() {
  const s = state.value;
  const [checked, setChecked] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [emberPhoto, setEmberPhoto] = useState<string | null>(null);
  const [emberBusy, setEmberBusy] = useState(false);
  const [emberCheck, setEmberCheck] = useState<EmberCheck | null>(null);

  const plan = buildPlan({
    adults: s.people,
    kids: s.kids,
    appetite: s.appetite,
    achuras: s.achuras,
    selected: s.selected,
  });

  const cookMin =
    s.selected.length > 0
      ? Math.max(...s.selected.map((id) => CUT_MAP[id]?.minutes ?? 0))
      : 25;
  const fire = buildFire({ fuel: s.fuel, cookMin, readyBy: s.readyBy, meatKg: plan.totalKg });

  const toggleCheck = (i: number) =>
    setChecked((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );

  const onEmberPhoto = async (file: File) => {
    try {
      const { dataUrl, blob } = await downscale(file);
      setEmberPhoto(dataUrl);
      setEmberBusy(true);
      const check = await analyzeEmbers(blob, s.fuel);
      setEmberCheck(check);
    } finally {
      setEmberBusy(false);
    }
  };

  const timeline: [string, string][] = [
    ['fire start', fire.fireStart],
    ['embers ready', fire.coalReady],
    ['meat on', fire.firstOn],
    ['serve', fire.serving],
  ];

  const fuel = FUELS.find((f) => f.id === s.fuel)!;

  return (
    <div class="fire">
      <h1 class="h1">Step 02 · Fire</h1>
      <p class="term">the fire decides the flavor. give it time.</p>

      <Card label="fuel">
        <Segmented<FuelId>
          label="Fuel"
          value={s.fuel}
          onChange={(v) => update({ fuel: v })}
          options={FUELS.map((f) => ({ value: f.id as FuelId, label: f.label }))}
        />
        <p class="term fire__fuel-hint">
          {fuel.local} — {fuel.hint}
        </p>
        <div class="fire__serve">
          <span class="mono-sm">longest cook</span>
          <span class="term" style="font-weight: 700">{fmtMinutes(cookMin)}</span>
        </div>
        <div class="fire__serve">
          <span class="mono-sm">Serve at</span>
          <input
            class="input time"
            type="time"
            value={s.readyBy}
            aria-label="Serve time"
            onChange={(e) => update({ readyBy: (e.target as HTMLInputElement).value })}
          />
        </div>
      </Card>

      <Card label="backwards from the hour" tone="dark">
        <ul class="timeline">
          {timeline.map(([label, time]) => (
            <li key={label} class="timeline__row">
              <span class="mono-sm timeline__label">{label}</span>
              <span class="timeline__time">{time}</span>
            </li>
          ))}
        </ul>
        {fire.fuelKg > 0 ? (
          <p class="term" style="color: var(--yolk); margin-top: var(--sp-3)">
            &gt; budget {fmtWeight(fuel.rateKgH, s.unit)}/h × {fmtWeight(plan.totalKg, s.unit)} meat ≈ {fmtWeight(fire.fuelKg, s.unit)} fuel
            {fire.bigFire ? ' — plan a double firebox' : ''}
          </p>
        ) : (
          <p class="term" style="color: var(--yolk); margin-top: var(--sp-3)">
            &gt; gas: no coal budget, just purge the box and preheat
          </p>
        )}
      </Card>

      <Card label="ember check — is it ready?">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          aria-label="Take a photo of the embers"
          onChange={(e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) onEmberPhoto(file);
          }}
        />
        <Button variant="dark" block onClick={() => inputRef.current?.click()}>
          {emberPhoto ? 'RE-READ THE EMBERS' : 'SNAP THE EMBERS'}
        </Button>
        {emberPhoto ? <img class="fire__img" src={emberPhoto} alt="Your ember bed" /> : null}
        {emberBusy ? <p class="term fire__busy">&gt; reading the coal bed…</p> : null}
        {emberCheck ? (
          <div class={`fire__should${emberCheck.ready ? ' fire__should--yes' : ''}`}>
            <p class="mono-sm">
              {emberCheck.ready ? 'READY · GO TIME' : 'NOT YET'} · {emberCheck.level} heat
            </p>
            <p class="term">&gt; {emberCheck.verdict}</p>
            <p class="term" style="color: var(--yolk)">&gt; {emberCheck.tip}</p>
          </div>
        ) : null}
      </Card>

      <Card label="the ritual">
        <ol class="ritual">
          {fire.steps.map((step, i) => (
            <li key={i} class="ritual__row">
              <span class="ritual__n mono-sm">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p class="ritual__title">{step.title}</p>
                <p class="term ritual__detail">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card label="readiness check">
        <ul class="check">
          {fire.checklist.map((item, i) => (
            <li key={item}>
              <button
                type="button"
                class={`check__box${checked.includes(i) ? ' check__box--on' : ''}`}
                aria-pressed={checked.includes(i)}
                onClick={() => toggleCheck(i)}
              >
                <span class="check__sq">{checked.includes(i) ? 'X' : ''}</span>
                <span class="term">{item}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card label="heat zones">
        <div class="zones" role="img" aria-label="Three heat zones on the grate">
          {['H', 'M', 'L'].map((lvl) => (
            <div key={lvl} class={`zone zone--${lvl.toLowerCase()}`}>
              <span class="mono-sm">{lvl}</span>
            </div>
          ))}
        </div>
        <p class="term" style="margin-top: var(--sp-3)">
          high = sear · medium = main zone · low = keep warm & slow
        </p>
      </Card>

      <Button block onClick={() => setScreen('cook')}>
        {fmtMinutes(fire.cookMin)} of fire — go cook →
      </Button>
    </div>
  );
}