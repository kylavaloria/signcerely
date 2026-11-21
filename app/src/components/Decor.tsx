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
  pen: [
    ".........NN.",
    "........NYYN",
    ".......NYYYN",
    "......NYYYN.",
    ".....NYYYN..",
    "....NYYYN...",
    "...NYYYN....",
    "..NWYYN.....",
    ".NWWYN......",
    ".NWWN.......",
    "NNNN........",
    "NN..........",
  ],
  magnifier: [
    "...BBBB.....",
    "..BbbbbB....",
    ".BbWbbbbB...",
    ".BbWbbbbB...",
    ".BbbbbbbB...",
    ".BbbbbbbB...",
    "..BbbbbB....",
    "...BBBBBB...",
    ".......BBB..",
    "........BBB.",
    ".........BBB",
    "..........BB",
  ],
  star: [
    "....Y....",
    "....Y....",
    "...YYY...",
    ".YYYYYYY.",
    "YYYYYYYYY",
    ".YYYYYYY.",
    "...YYY...",
    "....Y....",
    "....Y....",
  ],
  people: [
    "..BBB.....YYY.",
    ".BBBBB...YYYYY",
    ".BBBBB...YYYYY",
    "..BBB.....YYY.",
    "..............",
    ".BBBBB...YYYYY",
    "BBBBBBB.YYYYYY",
    "BBBBBBB.YYYYYY",
    "BBBBBBB.YYYYYY",
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

export type ArtName = keyof typeof ART;

/**
 * Decorations for the empty page margins beside the content. They sit near
 * the top of the page and only show when the window is wide enough that
 * they cannot touch the content (`content` is the page's max content width).
 */
export function PageDecor({
  content,
  left,
  right,
  leftChip,
  rightChip,
}: {
  content: 720 | 1000 | 1200 | 1240 | 1320;
  left: ArtName;
  right: ArtName;
  leftChip?: string;
  rightChip?: string;
}) {
  const edge = `calc(50% - ${content / 2}px - 150px)`;
  return (
    <div aria-hidden="true" className={`page-decor page-decor-${content}`}>
      <Orb size={104} style={{ left: edge, top: 40 }} />
      <span className="decor-float" style={{ left: `calc(${edge} + 22px)`, top: 58, ["--tilt" as string]: "-8deg" }}>
        <PixelArt name={left} pixel={5} />
      </span>
      {leftChip && (
        <Chip tone="yellow" style={{ left: `calc(${edge} + 6px)`, top: 172 }}>
          {leftChip}
        </Chip>
      )}
      <Orb size={30} tone="yellow" style={{ left: `calc(${edge} + 96px)`, top: 24 }} />
      <span className="decor-float slow" style={{ left: `calc(${edge} + 30px)`, top: 430, ["--tilt" as string]: "10deg" }}>
        <PixelArt name="star" pixel={5} />
      </span>

      <Orb size={84} style={{ right: edge, top: 250 }} />
      <span className="decor-float slow" style={{ right: `calc(${edge} + 12px)`, top: 262, ["--tilt" as string]: "9deg" }}>
        <PixelArt name={right} pixel={5} />
      </span>
      {rightChip && (
        <Chip tone="glass" style={{ right: `calc(${edge} + 4px)`, top: 356 }}>
          {rightChip}
        </Chip>
      )}
      <Orb size={46} style={{ right: `calc(${edge} + 70px)`, top: 96 }} />
      <span className="decor-float" style={{ right: `calc(${edge} + 6px)`, top: 60, ["--tilt" as string]: "-12deg" }}>
        <PixelArt name="star" pixel={4} />
      </span>
    </div>
  );
}

/** A small sphere with a pixel icon on it, for use inside a row or card. */
export function Badge({ name, size = 72, pixel = 4, tone = "blue" }: { name: ArtName; size?: number; pixel?: number; tone?: "blue" | "yellow" }) {
  return (
    <span aria-hidden="true" style={{ position: "relative", display: "inline-grid", placeItems: "center", width: size, height: size, flex: "none" }}>
      <Orb size={size} tone={tone} style={{ position: "absolute", inset: 0 }} />
      <PixelArt name={name} pixel={pixel} style={{ position: "relative", transform: "rotate(-6deg)" }} />
    </span>
  );
}
