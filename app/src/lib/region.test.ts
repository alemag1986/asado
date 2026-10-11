import { describe, expect, test } from 'vitest';
import {
  REGION_LAND,
  REGION_LAT_SCALE,
  REGION_MARKERS,
  REGION_WINDOW,
  regionProject,
} from './region';

const { minLon, maxLon, minLat, maxLat } = REGION_WINDOW;
const WIDTH = maxLon - minLon;
const TOP = regionProject(maxLat, 0).y;
const HEIGHT = regionProject(minLat, 0).y - TOP;

describe('region map data', () => {
  test('every marker sits inside the cropped window', () => {
    for (const m of REGION_MARKERS) {
      const { x, y } = regionProject(m.lat, m.lon);
      const px = x - minLon;
      const py = y - TOP;
      expect(px, `${m.id} x`).toBeGreaterThan(0);
      expect(px, `${m.id} x`).toBeLessThan(WIDTH);
      expect(py, `${m.id} y`).toBeGreaterThan(0);
      expect(py, `${m.id} y`).toBeLessThan(HEIGHT);
    }
  });

  test('coastlines are closed SVG paths for each country', () => {
    const entries = Object.entries(REGION_LAND);
    expect(entries.length).toBeGreaterThanOrEqual(6);
    for (const [name, d] of entries) {
      expect(d, name).toMatch(/^M/);
      expect(d, name).toMatch(/Z$/);
      expect(d.length, name).toBeGreaterThan(50);
    }
  });

  test('latitude scale matches the 35°S standard parallel', () => {
    expect(REGION_LAT_SCALE).toBeCloseTo(Math.cos((35 * Math.PI) / 180), 6);
  });
});
