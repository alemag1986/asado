import { useEffect, useState } from 'preact/hooks';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CUT_MAP } from '@/lib/cuts';
import { state } from '@/lib/store';
import { CookCut } from './CookCut';
import './Cook.css';

export function Cook() {
  const s = state.value;
  const cuts = s.selected.map((id) => CUT_MAP[id]).filter(Boolean);
  const [startTs, setStartTs] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [flips, setFlips] = useState<Record<string, number>>({});

  useEffect(() => {
    if (startTs == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startTs]);

  const elapsedMin = startTs != null ? (now - startTs) / 60000 : 0;

  return (
    <div class="cook">
      <h1 class="h1">Step 03 · Cook</h1>
      <p class="term">the only clock that matters is the fire's.</p>

      <Card label="the bench">
        {startTs == null ? (
          <Button block onClick={() => setStartTs(Date.now())}>
            DROP MEAT ON THE FIRE
          </Button>
        ) : (
          <div class="cook__clock">
            <p class="term">fire running</p>
            <p class="cook__elapsed">
              {Math.floor(elapsedMin / 60)}:{String(Math.floor(elapsedMin % 60)).padStart(2, '0')}
            </p>
          </div>
        )}
      </Card>

      <div class="cook__cuts">
        {cuts.map((cut) => (
          <CookCut
            key={cut.id}
            cut={cut}
            elapsedMin={elapsedMin}
            flipCount={flips[cut.id] ?? 0}
            onFlip={() => setFlips((p) => ({ ...p, [cut.id]: (p[cut.id] ?? 0) + 1 }))}
            tempUnit={s.temp}
          />
        ))}
      </div>

      <p class="term cook__disclaimer">
        cores are a guide — trust the poke, the juices, and the crowd.
      </p>
    </div>
  );
}