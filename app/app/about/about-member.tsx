"use client";

import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";
import { AboutNav, AboutHero } from "./sections/about-hero";
import { AboutGap } from "./sections/about-gap";
import { AboutResolution } from "./sections/about-resolution";
import { AboutHowItWorks } from "./sections/about-how-it-works";
import { AboutVisionCoda } from "./sections/about-vision-coda";

export function AboutMember() {
  useRevealOnScroll(".hero-reveal .reveal, .hero-reveal .reveal--scale");
  useRevealOnScroll(
    ".content-reveal .reveal, .content-reveal .reveal--scale, .content-reveal .reveal--form, .content-reveal .reveal--image"
  );

  return (
    <main className="bg-stone-50 text-stone-900 overflow-x-hidden font-body">
      <AboutNav />
      <AboutHero />
      <div className="content-reveal">
        <AboutGap />
        <AboutResolution />
        <AboutHowItWorks />
        <AboutVisionCoda />
      </div>
    </main>
  );
}
