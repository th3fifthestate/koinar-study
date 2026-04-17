"use client";

const grainSvg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E")`;

export function AboutResolution() {
  return (
    <section
      className="grid grid-cols-1 md:grid-cols-2"
      style={{ minHeight: "100dvh", background: "#e0dace" }}
    >
      {/* Image — order 1 mobile, order 2 desktop */}
      <div className="reveal--image relative overflow-hidden min-h-[50vh] md:min-h-full md:order-2">
        <img
          src="/images/12-communal-overhead.jpeg"
          alt="An overhead view of open Bibles and coffee cups on a round table"
          className="w-full h-full object-cover block"
          loading="lazy"
        />
      </div>
      {/* Text — order 2 mobile, order 1 desktop */}
      <div className="relative flex flex-col justify-center px-8 py-14 md:px-14 md:py-16 xl:px-[100px] xl:py-20 md:order-1">
        {/* Fractal noise grain texture */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: grainSvg,
            backgroundSize: "200px 200px",
          }}
        />
        <div className="relative z-[1]">
          <div className="reveal w-9 h-px bg-sage-300 mb-8" />
          <p className="reveal reveal-d1 font-body text-[1.05rem] md:text-[1.15rem] xl:text-[1.25rem] font-normal leading-[1.85] text-stone-700 max-w-[480px] xl:max-w-[520px]">
            Koinar writes in-depth Bible studies that examine every passage in its historical setting, its original language, and its place in the larger story.{" "}
            <span className="font-display italic text-stone-900">
              Not what a verse means to you — but what it means, and what it means for all of us.
            </span>
          </p>
          <p className="reveal reveal-d2 font-body text-[1.05rem] md:text-[1.15rem] xl:text-[1.25rem] font-normal leading-[1.85] text-stone-700 max-w-[480px] xl:max-w-[520px] mt-6">
            Every member is personally invited by someone they know. The library grows from the community&apos;s own studies — read, contributed, and shared together. There is no pressure to produce.{" "}
            <span className="font-display italic text-stone-900">
              Reading is a first-class act of devotion.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
