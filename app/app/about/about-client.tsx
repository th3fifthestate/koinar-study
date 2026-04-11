"use client";

import { useEffect } from "react";
import { AboutAuth } from "../components/about-auth";
import Link from "next/link";
import { ScrollHint } from "../components/scroll-hint";
import { DustMotes, LightShift } from "../components/fx";

/* Inline SVG for fractal noise grain texture */
const grainSvg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E")`;

export function AboutClient() {
  useEffect(() => {
    // Hero elements reveal on load
    setTimeout(() => {
      document
        .querySelectorAll(".hero-reveal .reveal, .hero-reveal .reveal--scale")
        .forEach((el) => el.classList.add("visible"));
    }, 100);

    // Intersection Observer for content below the fold
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    );

    document
      .querySelectorAll(
        ".content-reveal .reveal, .content-reveal .reveal--scale, .content-reveal .reveal--form, .content-reveal .reveal--image"
      )
      .forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-stone-50 text-stone-900 overflow-x-hidden font-body">
      {/* Navigation */}
      <Link
        href="/"
        className="fixed top-6 left-7 md:top-8 md:left-12 xl:left-20 z-[100] font-display text-[0.95rem] font-[800] uppercase tracking-[0.25em] text-[rgba(247,246,243,0.7)] no-underline transition-colors duration-250 ease-out hover:text-[rgba(247,246,243,1)]"
      >
        Koinar
      </Link>

      {/* ============================================================
         SECTION 1: Hero — Full viewport archway
         ============================================================ */}
      <section className="hero-reveal relative w-full overflow-hidden flex flex-col items-center justify-center" style={{ minHeight: "100dvh" }}>
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

      {/* Content sections — observed for scroll reveal */}
      <div className="content-reveal">
        {/* ============================================================
           SECTION 2: The Gap — Image left / Text right
           ============================================================ */}
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
              Scripture can feel vast. Ancient. Hard to know where to begin or what you&apos;re missing.
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

        {/* ============================================================
           SECTION 3: The Resolution — Text left / Image right
           ============================================================ */}
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
                Koinar generates in-depth Bible studies that examine every passage in its historical setting, its original language, and its place in the larger story.{" "}
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

        {/* ============================================================
           SECTION 4: CTA — Dark, centered
           ============================================================ */}
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
              <a
                href="mailto:hello@koinar.app"
                className="text-[rgba(247,246,243,0.35)] no-underline border-b border-[rgba(247,246,243,0.15)] transition-all duration-250 ease-out hover:text-[rgba(247,246,243,0.6)] hover:border-[rgba(247,246,243,0.3)]"
              >
                hello@koinar.app
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
