import { REGION_LAND, REGION_WINDOW, regionProject, type RegionMarker } from '@/lib/region';

const { minLon, maxLon, minLat, maxLat } = REGION_WINDOW;
const WIDTH = maxLon - minLon;
const TOP = regionProject(maxLat, 0).y;
const HEIGHT = regionProject(minLat, 0).y - TOP;
const BG = { x: -minLon, y: -TOP };
const PIN = 0.7; // map units — ~16px at phone width

export function RegionMap({
  markers,
  selectedId,
  onSelect,
}: {
  markers: RegionMarker[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <svg
      class="region-map"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Map of the southern cone — pick a regional grill style"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect class="region-water" x="0" y="0" width={WIDTH} height={HEIGHT} />
      <g transform={`translate(${BG.x} ${BG.y})`}>
        {Object.entries(REGION_LAND).map(([name, d]) => (
          <path key={name} class="region-land" d={d} />
        ))}
        {markers.map((m) => {
          const { x, y } = regionProject(m.lat, m.lon);
          const on = m.id === selectedId;
          const pick = () => onSelect?.(m.id);
          return (
            <g
              key={m.id}
              class={`region-pin${on ? ' region-pin--on' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={m.id}
              aria-pressed={on}
              onClick={pick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  pick();
                }
              }}
            >
              <rect
                class="region-pin__sq"
                x={x - PIN / 2}
                y={y - PIN / 2}
                width={PIN}
                height={PIN}
                fill={m.color}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
