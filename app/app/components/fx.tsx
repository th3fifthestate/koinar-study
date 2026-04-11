"use client";

/* Dust Motes — 8-10 tiny floating particles */
const dustParticles = [
  { left: "15%", top: "-5%", w: 2, dur: "18s", delay: "0s", opacity: 1 },
  { left: "30%", top: "-8%", w: 3, dur: "22s", delay: "-3s", opacity: 0.6 },
  { left: "50%", top: "-3%", w: 2, dur: "16s", delay: "-8s", opacity: 1 },
  { left: "65%", top: "-6%", w: 4, dur: "25s", delay: "-2s", opacity: 0.3, blur: 2 },
  { left: "40%", top: "-4%", w: 2, dur: "20s", delay: "-12s", opacity: 1 },
  { left: "75%", top: "-7%", w: 3, dur: "19s", delay: "-6s", opacity: 0.5 },
  { left: "25%", top: "-5%", w: 2, dur: "23s", delay: "-15s", opacity: 1 },
  { left: "55%", top: "-9%", w: 3, dur: "17s", delay: "-4s", opacity: 0.4 },
  { left: "85%", top: "-3%", w: 2, dur: "21s", delay: "-9s", opacity: 1 },
  { left: "10%", top: "-6%", w: 3, dur: "24s", delay: "-7s", opacity: 0.35 },
];

export function DustMotes({ count = 10 }: { count?: number }) {
  return (
    <div className="absolute inset-0 z-[1] overflow-hidden pointer-events-none">
      {dustParticles.slice(0, count).map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-[rgba(247,246,243,0.4)]"
          style={{
            left: p.left,
            top: p.top,
            width: p.w,
            height: p.w,
            filter: `blur(${p.blur ?? 1}px)`,
            opacity: p.opacity,
            animation: `dustFloat ${p.dur} linear ${p.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* Candle Flicker — warm glow pulse */
export function CandleFlicker() {
  return (
    <div
      className="absolute inset-0 z-[1] pointer-events-none"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, rgba(196,154,108,0.08) 0%, transparent 60%)",
        animation: "candleFlicker 4s ease-in-out infinite",
      }}
    />
  );
}

/* Steam Wisps — 3 rising blurred circles */
export function SteamWisps({
  bottom = "42%",
  left = "48%",
}: {
  bottom?: string;
  left?: string;
}) {
  const wisps = [
    { wispLeft: 0, dur: "8s", delay: "0s", w: 30, h: 80 },
    { wispLeft: 15, dur: "10s", delay: "-3s", w: 35, h: 90 },
    { wispLeft: -10, dur: "9s", delay: "-6s", w: 25, h: 70 },
  ];

  return (
    <div
      className="absolute z-[1] pointer-events-none"
      style={{ bottom, left }}
    >
      {wisps.map((w, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: w.wispLeft,
            width: w.w,
            height: w.h,
            background:
              "radial-gradient(ellipse at center, rgba(247,246,243,0.06) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(8px)",
            animation: `steamRise ${w.dur} ease-out ${w.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* Light Shift — slow ambient brightness pulse */
export function LightShift() {
  return (
    <div
      className="absolute inset-0 z-[1] pointer-events-none"
      style={{
        background:
          "radial-gradient(ellipse at 30% 40%, rgba(247,246,243,0.04) 0%, transparent 50%)",
        animation: "lightShift 12s ease-in-out infinite",
      }}
    />
  );
}
