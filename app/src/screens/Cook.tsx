import { fmtElapsed } from '@/lib/format';
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

  const elapsedMs = startTs != null ? Math.max(0, now - startTs) : 0;
  const elapsedMin = elapsedMs / 60000;

  const startClock = () => {
    const t = Date.now();
    setStartTs(t);
    setNow(t);
  };

  return (
    <div class="cook">
      <h1 class="h1">Step 03 · Cook</h1>
      <p class="term">the only clock that matters is the fire's.</p>

      <Card label="the bench">
        {startTs == null ? (
          <Button block onClick={startClock}>
            DROP MEAT ON THE FIRE
          </Button>
        ) : (
          <div class="cook__clock">
            <p class="term">fire running</p>
            <p class="cook__elapsed">{fmtElapsed(elapsedMs)}</p>
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