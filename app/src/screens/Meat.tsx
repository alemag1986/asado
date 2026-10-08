import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Segmented } from '@/components/Segmented';
import { Stepper } from '@/components/Stepper';
import { CUTS, CUT_MAP } from '@/lib/cuts';
import { fmtQty, fmtWeight } from '@/lib/format';
import { buildPlan } from '@/lib/plan';
import { state, update, toggleCut, setScreen } from '@/lib/store';
import type { Appetite, TempUnit, Unit } from '@/lib/types';
import './Meat.css';

type AchurasValue = 'on' | 'off';

export function Meat() {
  const s = state.value;
  const mainCuts = CUTS.filter((c) => c.kind !== 'achura');
  const plan = buildPlan({
    adults: s.people,
    kids: s.kids,
    appetite: s.appetite,
    achuras: s.achuras,
    selected: s.selected,
  });

  return (
    <div class="meat">
      <h1 class="h1">Step 01 · Meat</h1>
      <p class="term">swing by the carnicero with this list.</p>

      <Card label="the crowd">
        <Stepper label="People" value={s.people} onChange={(v) => update({ people: v })} min={1} max={40} />
        <Stepper label="Kids" value={s.kids} onChange={(v) => update({ kids: v })} min={0} max={20} />
        <div class="meat__row">
          <Segmented<Appetite>
            label="Appetite"
            value={s.appetite}
            onChange={(v) => update({ appetite: v })}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'normal', label: 'Normal' },
              { value: 'heavy', label: 'Heavy' },
            ]}
          />
        </div>
        <div class="meat__rowpair">
          <Segmented<Unit>
            label="Units"
            value={s.unit}
            onChange={(v) => update({ unit: v })}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
          />
          <Segmented<TempUnit>
            label="Temp"
            value={s.temp}
            onChange={(v) => update({ temp: v })}
            options={[
              { value: 'c', label: '°C' },
              { value: 'f', label: '°F' },
            ]}
          />
        </div>
        <div class="meat__row">
          <Segmented<AchurasValue>
            label="Achuras"
            value={s.achuras ? 'on' : 'off'}
            onChange={(v) => update({ achuras: v === 'on' })}
            options={[
              { value: 'on', label: 'Achuras' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </div>
      </Card>

      <Card label="the cuts" class="meat__cuts">
        <p class="mono-sm" style="margin-bottom: var(--sp-3)">pick the mains</p>
        <div class="meat__picks" role="listbox" aria-multiselectable="true">
          {mainCuts.map((cut) => {
            const on = s.selected.includes(cut.id);
            return (
              <button
                key={cut.id}
                type="button"
                role="option"
                aria-selected={on}
                class={`pick${on ? ' pick--on' : ''}`}
                onClick={() => toggleCut(cut.id)}
              >
                <span class="pick__tier">{cut.tier}</span>
                <span class="pick__names">
                  <span class="pick__name">{cut.name}</span>
                  <span class="mono-sm pick__local">{cut.local}</span>
                </span>
                <span class="pick__sw">
                  ~{fmtWeight(cut.perPersonKg, s.unit)}/pp
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card label="shopping list" tone="dark">
        <table class="list">
          <thead>
            <tr>
              <th class="mono-sm">cut</th>
              <th class="mono-sm">get</th>
            </tr>
          </thead>
          <tbody>
            {plan.items.map((item) => (
              <tr key={item.cutId}>
                <td>
                  <span class="list__name">{CUT_MAP[item.cutId].name}</span>
                  <span class="mono-sm list__local">{CUT_MAP[item.cutId].local}</span>
                </td>
                <td class="list__qty">{fmtQty(item.qty, s.unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p class="term" style="margin-top: var(--sp-3)">
          total ≈ {fmtWeight(plan.totalKg, s.unit)} bone-in
        </p>
        <p class="term" style="margin-top: var(--sp-1)">
          ≈ {fmtWeight(plan.totalKg / Math.max(1, s.people), s.unit)} per person
        </p>
        <p class="term" style="color: var(--yolk); margin-top: var(--sp-2)">
          &gt; {plan.tip}
        </p>
      </Card>

      {plan.order.length > 0 ? (
        <ol class="order">
          <li class="mono-sm">order on the grate</li>
          {plan.order.map((name, i) => (
            <li key={name} class="order__item mono-sm">
              <span class="order__n">{String(i + 1).padStart(2, '0')}</span>
              {name}
            </li>
          ))}
        </ol>
      ) : null}

      <Button block onClick={() => setScreen('fire')}>
        Build the fire →
      </Button>
    </div>
  );
}