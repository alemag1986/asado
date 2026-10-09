import { describe, expect, it } from 'vitest';
import { toAnalysis } from './analyze';

const RAW = {
  sear: 'dark',
  fat_render: 'render',
  doneness_est: 60,
  action: 'move_to_low',
  minutes: 8,
  confidence: 90,
  tip: 'Shell is hard.',
};

describe('toAnalysis', () => {
  it('maps snake_case API fields to camelCase', () => {
    const a = toAnalysis(RAW);
    expect(a).toEqual({
      sear: 'dark',
      fatRender: 'render',
      donenessEst: 60,
      action: 'move_to_low',
      minutes: 8,
      confidence: 90,
      tip: 'Shell is hard.',
    });
  });

  it('defaults fat_render to good when the model omits it', () => {
    const rest: Record<string, unknown> = { ...RAW };
    delete rest.fat_render;
    expect(toAnalysis(rest).fatRender).toBe('good');
  });
});