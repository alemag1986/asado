import type { Cut, FuelId } from './types';

export interface Analysis {
  sear: 'low' | 'good' | 'dark';
  fatRender: 'low' | 'good' | 'render';
  donenessEst: number;
  action: 'flip' | 'hold' | 'move_to_low' | 'pull';
  minutes: number;
  confidence: number;
  tip: string;
}

export interface EmberCheck {
  ready: boolean;
  level: 'low' | 'medium' | 'high';
  verdict: string;
  tip: string;
}

const MOCK: Analysis = {
  sear: 'good',
  fatRender: 'good',
  donenessEst: 58,
  action: 'flip',
  minutes: 6,
  confidence: 74,
  tip: "A good sear across most of the surface. Roll it a quarter turn and give the open face two more minutes.",
};

export function toAnalysis(raw: Record<string, unknown>): Analysis {
  return {
    sear: raw.sear as Analysis['sear'],
    fatRender: (raw.fat_render as Analysis['fatRender']) ?? 'good',
    donenessEst: Number(raw.doneness_est),
    action: raw.action as Analysis['action'],
    minutes: Number(raw.minutes),
    confidence: Number(raw.confidence),
    tip: String(raw.tip),
  };
}

function mockFor(cut: Cut, probeC?: number): Analysis {
  const tip =
    probeC && cut.targetTempC
      ? `Probe reads ${Math.round(probeC)}°C — ${Math.max(0, Math.round(cut.targetTempC - probeC))}°C from your ${cut.targetTempC}°C target. ${cut.pullRule}`
      : cut.pullRule;
  return { ...MOCK, tip };
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function analyze(
  image: Blob | null,
  cut: Cut,
  probeC?: number,
): Promise<Analysis> {
  if (!image) return mockFor(cut, probeC);

  try {
    const body = new FormData();
    body.set('image', image, 'grill.jpg');
    body.set('cut', cut.id);
    if (probeC != null) body.set('probe_c', String(probeC));
    const resp = await fetch('/api/cook/analyze', { method: 'POST', body });
    if (resp.ok) return toAnalysis((await resp.json()) as Record<string, unknown>);
  } catch {
    /* API unreachable — serve the offline advisor */
  }

  await delay(1100);
  return mockFor(cut, probeC);
}

export async function analyzeEmbers(image: Blob | null, fuel: FuelId): Promise<EmberCheck> {
  if (!image) return mockEmbers(fuel);

  try {
    const body = new FormData();
    body.set('image', image, 'embers.jpg');
    body.set('fuel', fuel);
    const resp = await fetch('/api/fire/check', { method: 'POST', body });
    if (resp.ok) return (await resp.json()) as EmberCheck;
  } catch {
    /* API unreachable — offline advisor */
  }

  await delay(1100);
  return mockEmbers(fuel);
}

function mockEmbers(fuel: FuelId): EmberCheck {
  return {
    ready: true,
    level: 'medium',
    verdict: 'embers are ash-gray, no flame on the surface',
    tip:
      fuel === 'wood'
        ? 'Give it one last split, let it fall to coal, then rake a full floor.'
        : 'Spread the bed even and give it five minutes of calm before the salt hits.',
  };
}