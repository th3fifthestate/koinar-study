"use client";

import { AboutAuth } from "../../components/about-auth";

export function AboutGuestCta() {
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

      <div className="relative z-[2] flex flex-col items-center">
        <p
          className="reveal font-display text-[1.4rem] md:text-[1.55rem] xl:text-[1.7rem] font-medium leading-[1.3] text-warmth mb-12"
          style={{
            textShadow:
              "0 1px 20px rgba(44,41,36,0.3), 0 0 40px rgba(44,41,36,0.15)",
          }}
        >
          A place is being prepared.
        </p>

        <div className="reveal--form flex flex-col items-center gap-4 w-full">
          <AboutAuth />
          <p className="font-body text-[0.65rem] font-medium uppercase tracking-[0.2em] text-[rgba(247,246,243,0.3)] mt-1">
            By invitation.
          </p>
        </div>

        <p className="reveal reveal-d3 font-body text-[0.75rem] font-normal text-[rgba(247,246,243,0.25)] mt-12">
          Questions?{" "}
          {/* TODO(brief-19): swap to <Link href="/contact"> once /contact ships */}
          <a
            href="mailto:hello@koinar.app"
            className="text-[rgba(247,246,243,0.35)] no-underline border-b border-[rgba(247,246,243,0.15)] transition-all duration-250 ease-out hover:text-[rgba(247,246,243,0.6)] hover:border-[rgba(247,246,243,0.3)]"
          >
            hello@koinar.app
          </a>
        </p>
      </div>
    </section>
  );
}
