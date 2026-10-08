import { useRef, useState } from 'preact/hooks';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { analyze, type Analysis } from '@/lib/analyze';
import { fmtMinutes, fmtTemp, cToF } from '@/lib/format';
import { downscale } from '@/lib/image';
import type { Cut, TempUnit } from '@/lib/types';

interface Props {
  cut: Cut;
  elapsedMin: number;
  flipCount: number;
  onFlip: () => void;
  tempUnit: TempUnit;
}

export function CookCut({ cut, elapsedMin, flipCount, onFlip, tempUnit }: Props) {
  const [sigs, setSigs] = useState<number[]>([]);
  const [probe, setProbe] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);

  const done = elapsedMin >= cut.minutes;
  const pct = Math.min(100, (elapsedMin / cut.minutes) * 100);
  const restLeft = Math.max(0, cut.restMin - Math.max(0, elapsedMin - cut.minutes));

  const probeC = parseFloat(probe);
  const hasProbe = Number.isFinite(probeC) && cut.targetTempC && cut.targetTempC > 0;
  const toTarget =
    hasProbe && cut.targetTempC
      ? tempUnit === 'f'
        ? cToF(cut.targetTempC) - cToF(probeC)
        : cut.targetTempC - probeC
      : null;

  const toggleSig = (i: number) =>
    setSigs((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  const onPhoto = async (file: File) => {
    try {
      const { dataUrl, blob } = await downscale(file);
      setPhoto(dataUrl);
      setBusy(true);
      const analysis = await analyze(blob, cut, hasProbe ? probeC : undefined);
      setResult(analysis);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      label={`${cut.local} · ${fmtMinutes(cut.minutes)}`}
      tone={done ? 'dark' : 'paper'}
    >
      <div class="cut">
        <div class="cut__head">
          <span class="cut__name">{cut.name}</span>
          <span class={`cut__tier tier tier--${cut.tier}`}>{cut.tier}</span>
        </div>

        {cut.targetTempC ? (
          <p class="term cut__temp">target core {fmtTemp(cut.targetTempC, tempUnit)}</p>
        ) : null}

        <div class="cut__bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <span class="cut__fill" style={`width: ${pct}%`} />
        </div>
        <p class={`term cut__status${done ? ' cut__status--done' : ''}`}>
          {done
            ? restLeft > 0
              ? `TAKE IT OFF — resting ${fmtMinutes(restLeft)}`
              : 'OFF THE FIRE — carve & serve'
            : `on the fire ${Math.floor(elapsedMin)}/${cut.minutes} min`}
        </p>

        {!done ? (
          <div class="cut__flip">
            <button type="button" class="btn btn--dark cut__flipbtn" onClick={onFlip}>
              FLIP · {flipCount}
            </button>
            <p class="term cut__fliprule">{cut.rotateRule}</p>
          </div>
        ) : null}

        {cut.targetTempC && cut.targetTempC > 0 ? (
          <div class="cut__probe">
            <label class="mono-sm" for={`probe-${cut.id}`}>
              probe core {tempUnit === 'f' ? '°F' : '°C'}
            </label>
            <div class="cut__probeline">
              <input
                id={`probe-${cut.id}`}
                class="input cut__probein"
                type="number"
                inputmode="decimal"
                placeholder={tempUnit === 'f' ? '154°F' : '68°C'}
                value={probe}
                aria-label={`Probe temperature for ${cut.name}`}
                onChange={(e) => setProbe((e.target as HTMLInputElement).value)}
              />
              {hasProbe && toTarget != null ? (
                <span class="term cut__delta">
                  {toTarget > 0 ? `${Math.round(toTarget)}${tempUnit === 'f' ? '°F' : '°C'} to target` : done ? 'at target' : 'at or past target'}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div class="cut__photo">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            aria-label={`Take a photo of the ${cut.name}`}
            onChange={(e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) onPhoto(file);
            }}
          />
          <div class="cut__photobtns">
            <Button variant="dark" disabled={busy} onClick={() => inputRef.current?.click()}>
              {photo ? 'RETOOK' : 'SNAP PHOTO'}
            </Button>
          </div>
          {photo ? <img class="cut__img" src={photo} alt={`Your ${cut.name} on the fire`} /> : null}
          {busy ? <p class="term cut__busy">&gt; studying the sear…</p> : null}
          {result ? (
            <div class="cut__analysis">
              <div class="cut__verdict mono-sm">
                {result.action} — {result.minutes} min · {result.confidence}% sure
              </div>
              <p class="term">
                sear {result.sear} · est core ~{fmtTemp(result.donenessEst, tempUnit)}
              </p>
              <p class="term" style="color: var(--yolk); margin-top: var(--sp-2)">
                &gt; {result.tip}
              </p>
            </div>
          ) : null}
        </div>

        <p class="mono-sm" style="margin: var(--sp-3) 0 var(--sp-1)">prep</p>
        <p class="term">{cut.prep}</p>

        <ul class="cut__sigs">
          <li class="mono-sm" style="color: var(--coal); padding: var(--sp-2) 0 0">done signals</li>
          {cut.signals.map((sig, i) => (
            <li key={sig}>
              <button
                type="button"
                class={`sig${sigs.includes(i) ? ' sig--on' : ''}`}
                aria-pressed={sigs.includes(i)}
                onClick={() => toggleSig(i)}
              >
                <span class="sig__sq">{sigs.includes(i) ? 'X' : ''}</span>
                <span class="term">{sig}</span>
              </button>
            </li>
          ))}
        </ul>

        <p class="term cut__pull">
          <span class="mono-sm">pull: </span>
          {cut.pullRule} Rest {cut.restMin} min. {cut.carve}
        </p>
      </div>
    </Card>
  );
}