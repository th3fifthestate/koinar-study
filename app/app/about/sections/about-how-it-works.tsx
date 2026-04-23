"use client";

const pillars = [
  {
    name: "Generate",
    body: "Begin with a passage. Koinar writes a full study from Scripture\u2019s original context \u2014 history, language, and the larger narrative arc. You choose the format; the engine writes the exegesis.",
  },
  {
    name: "Read",
    body: "Every study is built for deep reading. Bodoni and Literata typography, soft candlelit backgrounds, highlighter and margin-note tools for quiet attention. No ads, no nudges, no metrics dashboard.",
  },
  {
    name: "Explore",
    body: "Names, places, events, and ideas in each study are linked to deeper knowledge \u2014 biographies of the people Scripture names, historical context for the places they walked, branching maps that show how one passage connects to the whole canon. Go as deep as you want; every layer is there if you ask.",
  },
  {
    name: "Invite",
    body: "Koinar grows through personal invitation. Share a finished study with someone already in your life. The library is the community\u2019s own collected work \u2014 read, annotated, and passed along.",
  },
];

export function AboutHowItWorks() {
  return (
    <section
      className="px-8 py-20 md:px-14 md:py-24 xl:px-[100px] xl:py-28"
      style={{ background: "#eae5dc" }}
    >
      {/* Eyebrow */}
      <div className="mb-16 md:mb-20">
        <div className="w-9 h-px bg-sage-300 mb-8" />
        <span className="font-body text-[0.85rem] font-semibold uppercase tracking-[0.3em] text-stone-500">
          How it works
        </span>
      </div>

      {/* Pillars */}
      <div className="max-w-2xl xl:max-w-3xl space-y-0">
        {pillars.map((pillar, i) => (
          <div key={pillar.name}>
            {i > 0 && <div className="w-9 h-px bg-sage-300 my-12 md:my-14" />}
            <div className="reveal">
              <h2 className="font-display text-[1.75rem] md:text-[2rem] font-normal text-warmth mb-4 leading-[1.2]">
                {pillar.name}
              </h2>
              <p className="font-body text-[1.05rem] md:text-[1.15rem] xl:text-[1.2rem] font-normal leading-[1.85] text-stone-700">
                {pillar.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
