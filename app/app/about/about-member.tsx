"use client";

import { useEffect } from "react";
import { AboutNav, AboutHero } from "./sections/about-hero";
import { AboutGap } from "./sections/about-gap";
import { AboutResolution } from "./sections/about-resolution";
import { AboutHowItWorks } from "./sections/about-how-it-works";
import { AboutVisionCoda } from "./sections/about-vision-coda";

export function AboutMember() {
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
