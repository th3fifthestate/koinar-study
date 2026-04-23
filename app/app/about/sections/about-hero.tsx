"use client";

import Link from "next/link";
import { ScrollHint } from "../../components/scroll-hint";
import { DustMotes, LightShift } from "../../components/fx";

export function AboutHero() {
  return (
    <section
      className="hero-reveal relative w-full overflow-hidden flex flex-col items-center justify-center"
      style={{ minHeight: "100dvh" }}
    >
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/11-stone-archway.jpeg"
          alt=""
          role="presentation"
          className="w-full h-full object-cover will-change-transform"
          style={{ animation: "kenBurns 35s linear infinite alternate" }}
        />
        {/* Vignette */}
        <div
          className="absolute inset-0 z-[2]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, rgba(44,41,36,0.25) 0%, rgba(44,41,36,0.55) 100%), linear-gradient(to bottom, rgba(44,41,36,0.05) 0%, rgba(44,41,36,0.2) 50%, rgba(44,41,36,0.7) 100%)",
          }}
        />
      </div>

      {/* FX */}
      <DustMotes count={8} />
      <LightShift />

      {/* Content */}
      <div className="relative z-[3] text-center flex flex-col items-center px-7">
        <span
          className="reveal reveal-d1 font-body text-[0.85rem] font-semibold uppercase tracking-[0.3em] text-[rgba(247,246,243,0.7)] mb-7"
          style={{ textShadow: "0 1px 12px rgba(44,41,36,0.4), 0 0 30px rgba(44,41,36,0.2)" }}
        >
          About
        </span>
        <h1
          className="reveal--scale font-display text-[3.5rem] md:text-[4.5rem] xl:text-[5.5rem] font-[800] leading-[1.05] tracking-[0.2em] md:tracking-[0.24em] text-stone-50 mb-10 md:mb-12 xl:mb-14"
          style={{
            textShadow:
              "0 2px 40px rgba(44,41,36,0.4), 0 0 80px rgba(44,41,36,0.2)",
          }}
        >
          KOINAR
        </h1>
        <p
          className="reveal reveal-d2 font-display text-[1.1rem] md:text-[1.2rem] xl:text-[1.3rem] font-normal italic leading-[1.7] text-[rgba(247,246,243,0.7)]"
          style={{ textShadow: "0 1px 20px rgba(44,41,36,0.4)" }}
        >
          From <em className="not-italic text-warmth">koinonia</em> — deep fellowship.
          <br />
          From <em className="not-italic text-warmth">edah</em> — God&apos;s gathered assembly.
        </p>
      </div>

      <ScrollHint />
    </section>
  );
}

export function AboutNav() {
  return (
    <Link
      href="/"
      className="fixed top-6 left-7 md:top-8 md:left-12 xl:left-20 z-[100] font-display text-[0.95rem] font-[800] uppercase tracking-[0.25em] text-[rgba(247,246,243,0.7)] no-underline transition-colors duration-250 ease-out hover:text-[rgba(247,246,243,1)]"
    >
      Koinar
    </Link>
  );
}
