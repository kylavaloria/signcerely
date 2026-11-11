/**
 * Purely decorative artwork: glossy spheres, pixel-art icons and floating labels.
 * Everything here is aria-hidden and never takes clicks or layout space.
 */

const PALETTE: Record<string, string> = {
  B: "#1F6FD6", // blue
  b: "#9CC8F7", // light blue
  W: "#FFFFFF",
  Y: "#FFDD1F", // yellow
  y: "#F2C200", // deeper yellow
  N: "#12305C", // navy
};

const ART = {
  document: [
    ".BBBBBBBBB....",
    ".BWWWWWWWBB...",
    ".BWWWWWWWBWB..",
    ".BWWWWWWWBBBB.",
    ".BWWWWWWWWWWB.",
    ".BWbbbbbbbWWB.",
    ".BWWWWWWWWWWB.",
    ".BWbbbbbbbbWB.",
    ".BWWWWWWWWWWB.",
    ".BWbbbbbWWWWB.",
    ".BWWWWWWWWWWB.",
    ".BWWWyWWWyWWB.",
    ".BWWyWyWyWWWB.",
    ".BWyWWWyWWWWB.",
    ".BWWWWWWWWWWB.",
    ".BBBBBBBBBBBB.",
  ],
  check: [
    "..YYYYYYYY..",
    ".YYYYYYYYYY.",
    "YYYYYYYYYBYY",
    "YYYYYYYYBBYY",
    "YYYYYYYBBYYY",
    "YYBYYYBBYYYY",
    "YYBBYBBYYYYY",
    "YYYBBBYYYYYY",
    "YYYYBYYYYYYY",
    "YYYYYYYYYYYY",
    ".YYYYYYYYYY.",
    "..YYYYYYYY..",
  ],
  mail: [
    "BBBBBBBBBBBBBB",
    "BYBWWWWWWWWBYB",
    "BWYBWWWWWWBYWB",
    "BWWYBWWWWBYWWB",
    "BWWWYBBBBYWWWB",
    "BWWWWYYYYWWWWB",
    "BWWWWWWWWWWWWB",
    "BWWWWWWWWWWWWB",
    "BWWWWWWWWWWWWB",
    "BBBBBBBBBBBBBB",
  ],
  cursor: [
    "W...........",
    "WW..........",
    "WYW.........",
    "WYYW........",
    "WYYYW.......",
    "WYYYYW......",
    "WYYYYYW.....",
    "WYYYYYYW....",
    "WYYYYYYYW...",
    "WYYYYYWWWW..",
    "WYYWYYW.....",
    "WYW.WYYW....",
    "WW..WYYW....",
    "W....WYYW...",
    ".....WYYW...",
    "......WW....",
  ],
  shield: [
    "..BBBBBBBB..",
    ".BBbbbbbbBB.",
    "BBbbbbbbbbBB",
    "BbbbbbbbWbbB",
    "BbbbbbbWWbbB",
    "BbbWbbWWbbbB",
    "BbbWWWWbbbbB",
    "BBbbWWbbbbBB",
    ".BbbbbbbbbB.",
    ".BBbbbbbbBB.",
    "..BBbbbbBB..",
    "...BBBBBB...",
    ".....BB.....",
  ],
} as const;

export function PixelArt({ name, pixel = 6, className, style }: { name: keyof typeof ART; pixel?: number; className?: string; style?: React.CSSProperties }) {
  const rows = ART[name];
  const w = rows[0].length;
  const h = rows.length;
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={w * pixel}
      height={h * pixel}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      style={{ filter: "drop-shadow(0 6px 10px rgba(18,48,92,.22))", ...style }}
    >
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => (c === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={PALETTE[c]} />)),
      )}
    </svg>
  );
}

export function Orb({ size, tone = "blue", style }: { size: number; tone?: "blue" | "yellow"; style?: React.CSSProperties }) {
  return <span aria-hidden="true" className={`orb orb-${tone}`} style={{ width: size, height: size, ...style }} />;
}

export function Chip({ children, tone = "blue", style }: { children: React.ReactNode; tone?: "blue" | "yellow" | "glass"; style?: React.CSSProperties }) {
  return (
    <span aria-hidden="true" className={`decor-chip decor-chip-${tone}`} style={style}>
      {children}
    </span>
  );
}

/** Absolutely-positioned layer for decorations. The parent must be position: relative. */
export function DecorLayer({ children, wideOnly = true }: { children: React.ReactNode; wideOnly?: boolean }) {
  return (
    <div aria-hidden="true" className={`decor-layer${wideOnly ? " wide-only" : ""}`}>
      {children}
    </div>
  );
}
