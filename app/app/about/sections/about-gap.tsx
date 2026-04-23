"use client";

export function AboutGap() {
  return (
    <section
      className="grid grid-cols-1 md:grid-cols-2"
      style={{ minHeight: "100dvh", background: "#eae5dc" }}
    >
      <div className="reveal--image relative overflow-hidden min-h-[50vh] md:min-h-full">
        <img
          src="/images/09-morning-porch.jpeg"
          alt="An open Bible and journal on a sunlit porch table"
          className="w-full h-full object-cover block"
          loading="lazy"
        />
      </div>
      <div className="flex flex-col justify-center px-8 py-14 md:px-14 md:py-16 xl:px-[100px] xl:py-20">
        <div className="reveal w-9 h-px bg-sage-300 mb-8" />
        <p className="reveal reveal-d1 font-body text-[1.05rem] md:text-[1.15rem] xl:text-[1.25rem] font-normal leading-[1.85] text-stone-700 max-w-[480px] xl:max-w-[520px]">
          Scripture is vast. Ancient. Easy to read and easy to miss.
        </p>
        <p className="reveal reveal-d2 font-body text-[1.05rem] md:text-[1.15rem] xl:text-[1.25rem] font-normal leading-[1.85] text-stone-700 max-w-[480px] xl:max-w-[520px] mt-6">
          Personal study is sacred —{" "}
          <span className="font-display italic text-stone-900">
            a quiet act of devotion.
          </span>{" "}
          But some things only come into focus when someone else is reading alongside you.
        </p>
      </div>
    </section>
  );
}
