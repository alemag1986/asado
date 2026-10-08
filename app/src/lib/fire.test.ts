import { describe, expect, test } from 'vitest';
import { buildFire } from './fire';

describe('buildFire', () => {
  test('charcoal, 90 min cook, ready 20:00', () => {
    const fire = buildFire({ fuel: 'charcoal', cookMin: 90, readyBy: '20:00' });
    expect(fire.fireStart).toBe('18:00'); // 30 build + 90 cook
    expect(fire.coalReady).toBe('18:30');
    expect(fire.firstOn).toBe(fire.coalReady);
    expect(fire.serving).toBe('20:00');
    expect(fire.fuelKg).toBeGreaterThan(0);
    expect(fire.checklist.length).toBeGreaterThan(0);
  });

  test('wood builds slower and burns more', () => {
    const wood = buildFire({ fuel: 'wood', cookMin: 90, readyBy: '20:00' });
    const coal = buildFire({ fuel: 'charcoal', cookMin: 90, readyBy: '20:00' });
    expect(wood.fireStart).toBe('17:40');
    expect(wood.fuelKg).toBeGreaterThan(coal.fuelKg);
  });

  test('gas is instant and burns no fuel by the kg', () => {
    const gas = buildFire({ fuel: 'gas', cookMin: 90, readyBy: '20:00' });
    expect(gas.fuel.buildMin).toBe(5);
    expect(gas.fuelKg).toBe(0);
  });

  test('late-night serving wraps past midnight', () => {
    const fire = buildFire({ fuel: 'charcoal', cookMin: 30, readyBy: '01:00' });
    expect(fire.fireStart).toBe('00:00');
    // Serving before the fire would fit on the same day wraps to the day before.
    const wrap = buildFire({ fuel: 'charcoal', cookMin: 120, readyBy: '00:30' });
    expect(wrap.fireStart).toBe('22:00');
  });

  test('fuel grows with the meat on the grate', () => {
    const small = buildFire({ fuel: 'wood', cookMin: 90, readyBy: '20:00', meatKg: 2 });
    const crowd = buildFire({ fuel: 'wood', cookMin: 90, readyBy: '20:00', meatKg: 18 });
    expect(crowd.fuelKg).toBeGreaterThan(small.fuelKg);
    expect(crowd.bigFire).toBe(true);
    expect(small.bigFire).toBe(false);
  });
});