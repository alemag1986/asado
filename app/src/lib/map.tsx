export const GRID = [
  '..........................',
  '..........................',
  '....x.....................',
  '...xx.....................',
  '...xx...xx................',
  '..xxx..xxxx...............',
  '..xx...xxxx................',
  '..xx...xxxxx...............',
  '.xx...xxxxxxx..............',
  '.xx..xxxxxxxxxx............',
  '.xx.xxxxxxxxxxxxxuux.......',
  '.x.xxxxxxxxxxxxxxuuux......',
  '.xx.xxxxxxxxxxxxxxuux......',
  '..x.xxxxxxxxxxxxxxx........',
  '...xxxxxxxxxxxxxxx.........',
  '....xxxxxxxxxxxxx..........',
  '.....xxxxxxxxxxxx..........',
  '......xxxxxxxxxx...........',
  '.......xxxxxxxx............',
  '........xxxxxx.............',
  '.........xxxx..............',
  '.........xx................',
  '..........xx...............',
  '..........x................',
];

const CELL = 12;

export interface MapMarker {
  id: string;
  col: number;
  row: number;
  color: string;
}

export function MapSvg({
  markers,
  selectedId,
}: {
  markers: MapMarker[];
  selectedId?: string;
}) {
  const width = Math.max(...GRID.map((r) => r.length)) * CELL;
  const height = GRID.length * CELL;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Pixel map of the grill countries"
      shape-rendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      {GRID.flatMap((row, y) =>
        [...row].flatMap((ch, x) =>
          ch === '.' ? [] : [
            <rect
              key={`${x}-${y}`}
              x={x * CELL}
              y={y * CELL}
              width={CELL}
              height={CELL}
              fill={ch === 'u' ? 'var(--coal)' : 'var(--ink)'}
            />,
          ],
        ),
      )}
      {markers.map((m) => {
        const selected = m.id === selectedId;
        const x = m.col * CELL;
        const y = m.row * CELL;
        return (
          <g key={m.id}>
            {selected ? (
              <rect x={x + 4} y={y + 3} width={CELL} height={CELL} fill="var(--ink)" />
            ) : null}
            <rect
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              fill={m.color}
              stroke="var(--ink)"
              stroke-width="2"
            />
          </g>
        );
      })}
    </svg>
  );
}