"use client";

export function AboutVisionCoda() {
  return (
    <section
      className="relative flex flex-col items-center justify-center text-center text-stone-50 overflow-hidden px-7 md:px-12 xl:px-20"
      style={{ minHeight: "100dvh" }}
    >
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/11-stone-archway.jpeg"
          alt=""
          role="presentation"
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, rgba(44,41,36,0.4) 0%, rgba(44,41,36,0.6) 100%), linear-gradient(to bottom, rgba(44,41,36,0.3) 0%, rgba(44,41,36,0.5) 100%)",
          }}
        />
      </div>

      <div className="relative z-[2] flex flex-col items-center max-w-xl">
        <h2
          className="reveal font-display text-[1.4rem] md:text-[1.55rem] xl:text-[1.7rem] font-medium italic leading-[1.3] text-warmth mb-8"
          style={{
            textShadow: "0 1px 20px rgba(44,41,36,0.3), 0 0 40px rgba(44,41,36,0.15)",
          }}
        >
          A quiet fellowship.
        </h2>

        <p
          className="reveal reveal-d1 font-body text-[1rem] md:text-[1.05rem] font-normal leading-[1.85] text-[rgba(247,246,243,0.7)]"
          style={{ maxWidth: "36ch" }}
        >
          Koinar exists because Scripture was always meant to be read together. Not performed. Not scrolled past. Read with care, and with others who care. What you find here is not a product. It is a table.
        </p>

        <p className="reveal reveal-d2 font-body text-base font-normal text-[rgba(247,246,243,0.5)] mt-10 leading-[1.8]">
          Questions, corrections, or a passage you&apos;d like us to study?{" "}
          <a
            href="mailto:hello@koinar.app"
            className="text-[rgba(247,246,243,0.5)] no-underline border-b border-[rgba(247,246,243,0.2)] transition-all duration-250 ease-out hover:text-[rgba(247,246,243,0.75)] hover:border-[rgba(247,246,243,0.4)]"
          >
            hello@koinar.app
          </a>
          {" \u00b7 "}
          {/* TODO(brief-19): swap to <Link href="/contact"> once /contact ships */}
          <a
            href="mailto:hello@koinar.app"
            className="text-[rgba(247,246,243,0.5)] no-underline border-b border-[rgba(247,246,243,0.2)] transition-all duration-250 ease-out hover:text-[rgba(247,246,243,0.75)] hover:border-[rgba(247,246,243,0.4)]"
          >
            Contribute feedback
          </a>
        </p>
      </div>
    </section>
  );
}
