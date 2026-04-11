"use client";

import { useEffect, useSyncExternalStore, useCallback } from "react";
import Link from "next/link";
import { EmailForm } from "./components/email-form";
import { ScrollHint } from "./components/scroll-hint";
import {
  DustMotes,
  CandleFlicker,
  SteamWisps,
  LightShift,
} from "./components/fx";

type Mood = "morning" | "day" | "evening";

function computeMood(): Mood {
  if (typeof window !== "undefined") {
    const override = new URLSearchParams(window.location.search).get("mood");
    if (override === "morning" || override === "day" || override === "evening") {
      return override;
    }
  }
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "day";
  return "evening";
}

/* Compute mood synchronously to avoid blank flash on back-navigation */
const subscribe = () => () => {};
function useMood(): Mood {
  return useSyncExternalStore(
    subscribe,
    computeMood,
    // SSR fallback — use time-based default
    () => "day" as Mood
  );
}

/* Scene background + vignette overlay */
function SceneBg({
  src,
  heavy,
  alt,
}: {
  src: string;
  heavy?: boolean;
  alt?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-0">
      <img
        src={src}
        alt=""
        role="presentation"
        className="w-full h-full object-cover will-change-transform"
        style={{
          animation: alt
            ? "kenBurnsAlt 30s linear infinite alternate"
            : "kenBurns 30s linear infinite alternate",
        }}
      />
      {/* Vignette overlay */}
      <div
        className="absolute inset-0 z-[2]"
        style={{
          background: heavy
            ? "radial-gradient(ellipse at center, rgba(44,41,36,0.45) 0%, rgba(44,41,36,0.6) 100%), linear-gradient(to bottom, rgba(44,41,36,0.35) 0%, rgba(44,41,36,0.4) 40%, rgba(44,41,36,0.5) 100%)"
            : "radial-gradient(ellipse at center, rgba(44,41,36,0.35) 0%, rgba(44,41,36,0.55) 100%), linear-gradient(to bottom, rgba(44,41,36,0.1) 0%, rgba(44,41,36,0.3) 35%, rgba(44,41,36,0.45) 100%)",
        }}
      />
    </div>
  );
}

/* Copy data per mood */
const moodData: Record<
  Mood,
  {
    lead: string;
    body: string;
    tagline: string;
    scene1Img: string;
    scene2Img: string;
  }
> = {
  morning: {
    lead: "The Word deserves more than a search bar and a white page.",
    body: "Every passage studied in its full context \u2014 historical, linguistic, canonical \u2014 and read together by people who were invited to be here.",
    tagline: "Come and see.",
    scene1Img: "/images/09-morning-porch.jpeg",
    scene2Img: "/images/05-solomons-portico.jpeg",
  },
  day: {
    lead: "Not another reading plan. Not another daily devotional.",
    body: "A place where every study goes deeper \u2014 context, language, history \u2014 and every insight is shared with people who were meant to be here.",
    tagline: "For those who seek together.",
    scene1Img: "/images/10-roundtable-study.jpeg",
    scene2Img: "/images/02-day-coffee-shop.jpeg",
  },
  evening: {
    lead: "They devoted themselves to the teaching and to each other. That devotion continues.",
    body: "A place where Scripture is studied the way it was meant to be \u2014 in full context, in real community.",
    tagline: "A place is being prepared.",
    scene1Img: "/images/04-acts2-house-church.jpeg",
    scene2Img: "/images/06-acts2-courtyard-meal.jpeg",
  },
};

/* FX components per mood per scene */
function MoodFx({ mood, scene }: { mood: Mood; scene: 1 | 2 }) {
  if (mood === "morning" && scene === 1) {
    return (
      <>
        <SteamWisps bottom="42%" left="48%" />
        <LightShift />
      </>
    );
  }
  if (mood === "morning" && scene === 2) {
    return (
      <>
        <DustMotes count={10} />
        <LightShift />
      </>
    );
  }
  if (mood === "day" && scene === 1) {
    return (
      <>
        <SteamWisps bottom="48%" left="35%" />
        <LightShift />
      </>
    );
  }
  if (mood === "day" && scene === 2) {
    return (
      <>
        <SteamWisps bottom="50%" left="42%" />
        <LightShift />
      </>
    );
  }
  if (mood === "evening" && scene === 1) {
    return (
      <>
        <DustMotes count={10} />
        <CandleFlicker />
      </>
    );
  }
  if (mood === "evening" && scene === 2) {
    return <CandleFlicker />;
  }
  return null;
}

export function TeaserClient() {
  const mood = useMood();

  const setupReveals = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -30px 0px" }
    );
    node
      .querySelectorAll(".reveal, .reveal--scale, .reveal--form")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Preload all images (instant on mood override)
  useEffect(() => {
    const allImages = [
      "/images/09-morning-porch.jpeg",
      "/images/05-solomons-portico.jpeg",
      "/images/10-roundtable-study.jpeg",
      "/images/02-day-coffee-shop.jpeg",
      "/images/04-acts2-house-church.jpeg",
      "/images/06-acts2-courtyard-meal.jpeg",
    ];
    allImages.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  const data = moodData[mood];

  return (
    <div
      ref={setupReveals}
      className="bg-stone-900 text-stone-50 overflow-x-hidden"
      style={{
        scrollSnapType: "y mandatory",
        scrollBehavior: "smooth",
        height: "100dvh",
        overflowY: "auto",
      }}
    >
      {/* Navigation */}
      <Link
        href="/about"
        className="fixed top-6 right-7 md:top-8 md:right-12 xl:right-20 z-[100] font-body text-[0.85rem] font-semibold uppercase tracking-[0.3em] text-[rgba(247,246,243,0.7)] no-underline transition-colors duration-250 ease-out hover:text-[rgba(247,246,243,1)]"
      >
        About
      </Link>

      {/* ============================================================
         SCENE 1 — Wordmark + Lead
         ============================================================ */}
      <section
        className="relative w-full flex flex-col items-center justify-center overflow-hidden"
        style={{ height: "100dvh", scrollSnapAlign: "start" }}
      >
        <SceneBg src={data.scene1Img} />
        <MoodFx mood={mood} scene={1} />

        <div className="relative z-[3] max-w-[640px] md:max-w-[720px] xl:max-w-[800px] px-7 md:px-12 text-center flex flex-col items-center">
          <h1
            className="reveal--scale font-display text-[3.5rem] md:text-[4.5rem] xl:text-[5.5rem] font-[800] leading-[1.05] tracking-[0.2em] md:tracking-[0.24em] text-stone-50 mb-12 md:mb-14 xl:mb-16"
            style={{
              textShadow:
                "0 2px 40px rgba(44,41,36,0.4), 0 0 80px rgba(44,41,36,0.2)",
            }}
          >
            KOINAR
          </h1>
          <div className="reveal reveal-d1 w-10 md:w-12 xl:w-14 h-px bg-[rgba(168,184,160,0.5)] mb-9 md:mb-10 xl:mb-11" />
          <p
            className="reveal reveal-d2 font-display text-[1.35rem] md:text-[1.55rem] xl:text-[1.7rem] font-medium italic leading-[1.55] text-stone-50 max-w-[520px] md:max-w-[560px] xl:max-w-[600px]"
            style={{
              textShadow:
                "0 0 1px rgba(247,246,243,0.6), 0 1px 12px rgba(44,41,36,0.5), 0 2px 30px rgba(44,41,36,0.3)",
            }}
          >
            {data.lead}
          </p>
        </div>

        <ScrollHint />
      </section>

      {/* ============================================================
         SCENE 2 — Body copy + Tagline + Form
         ============================================================ */}
      <section
        className="relative w-full flex flex-col items-center justify-center overflow-hidden"
        style={{ height: "100dvh", scrollSnapAlign: "start" }}
      >
        <SceneBg src={data.scene2Img} heavy alt />
        <MoodFx mood={mood} scene={2} />

        <div className="relative z-[3] max-w-[640px] md:max-w-[720px] xl:max-w-[800px] px-7 md:px-12 text-center flex flex-col items-center">
          <p
            className="reveal font-body text-[1.1rem] md:text-[1.2rem] xl:text-[1.3rem] font-normal leading-[1.85] text-[rgba(247,246,243,0.85)] max-w-[500px] md:max-w-[540px] xl:max-w-[560px] mb-12"
            style={{
              textShadow:
                "0 1px 20px rgba(44,41,36,0.35), 0 0 50px rgba(44,41,36,0.15)",
            }}
          >
            {data.body}
          </p>
          <p
            className="reveal reveal-d1 font-display text-[1.4rem] md:text-[1.55rem] xl:text-[1.7rem] font-medium leading-[1.3] text-warmth mb-10 md:mb-12 xl:mb-13"
            style={{
              textShadow:
                "0 1px 20px rgba(44,41,36,0.3), 0 0 40px rgba(44,41,36,0.15)",
            }}
          >
            {data.tagline}
          </p>

          <div className="reveal--form reveal-d2 flex flex-col items-center gap-4 w-full">
            <p className="font-body text-[0.65rem] font-medium uppercase tracking-[0.2em] text-[rgba(247,246,243,0.4)] mb-5">
              Coming soon.
            </p>
            <EmailForm />
            <p className="font-body text-[0.65rem] font-medium uppercase tracking-[0.2em] text-[rgba(247,246,243,0.3)] mt-1">
              By invitation.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
