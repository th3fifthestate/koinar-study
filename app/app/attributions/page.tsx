import Link from "next/link";
import { CITATIONS } from "@/lib/translations/citations";
import type { TranslationId } from "@/lib/translations/registry";

export const metadata = {
  title: "Attributions — Koinar",
  description:
    "Scripture translations, Bible APIs, and knowledge graph data sources that Koinar is built on.",
};

// Shipping translation order for the Scripture Translations section. We show
// BSB + the three licensed translations unconditionally (even when an
// environment is missing API.Bible keys) because readers need to see what
// Koinar is licensed to serve, independent of which backend the current
// deployment happens to reach. ESV is rendered as a separate "coming soon"
// card below the block since its citation stub isn't legally complete until
// Crossway approval lands.
const SHIPPING_TRANSLATIONS: TranslationId[] = ["BSB", "NLT", "NIV", "NASB"];

// Per-translation routing blurbs. Shown on /attributions#scripture-api so
// copyright-curious readers can see both the legal citation (above) and the
// technical upstream (here) side by side.
const API_ROUTING: Array<{
  id: TranslationId;
  name: string;
  blurb: string;
}> = [
  {
    id: "NLT",
    name: "NLT — New Living Translation",
    blurb:
      "Served via API.Bible. Cached on a 7-day rolling window — up to ~500 verses per translation, with entries refreshed hourly once they pass 75% of their lifetime.",
  },
  {
    id: "NIV",
    name: "NIV — New International Version",
    blurb:
      "Served via API.Bible, display-only, with a per-view cap of 2 chapters or 25 verses per Biblica §V.F. Attempts to render past the cap replace the overflow passages with a truncation marker.",
  },
  {
    id: "NASB",
    name: "NASB — New American Standard Bible (1995)",
    blurb:
      "Served via API.Bible. Same 7-day rolling cache as NLT, with a higher storage cap (~1,000 verses).",
  },
];

export default function Attributions() {
  return (
    <main>
      {/* Hero */}
      <header className="bg-stone-50 px-8 py-16 md:px-14 md:py-24 xl:px-[100px]">
        <div className="max-w-3xl">
          <Link
            href="/"
            className="block font-body text-sm text-stone-500 hover:text-stone-700 transition-colors mb-8"
          >
            ← Back to Library
          </Link>
          <span className="font-body text-[0.75rem] font-semibold uppercase tracking-[0.3em] text-stone-400">
            Attributions
          </span>
          <h1 className="mt-6 font-display text-[2.5rem] md:text-[3.25rem] font-normal leading-[1.1] text-stone-900">
            What we&apos;ve borrowed, licensed, and learned from.
          </h1>
          <p className="mt-6 font-body text-base md:text-lg leading-relaxed text-stone-600 max-w-2xl">
            Koinar is built on the work of translators, scholars, and open-data
            projects. This page is their roll call.
          </p>
        </div>
      </header>

      {/* Scripture Translations */}
      <section
        id="scripture-translations"
        className="bg-stone-100 px-8 py-16 md:px-14 md:py-20 xl:px-[100px] scroll-mt-20"
      >
        <div className="max-w-3xl">
          <div className="w-9 h-px bg-sage-300 mb-8" />
          <h2 className="font-display text-2xl md:text-3xl font-normal text-stone-900 mb-2">
            Scripture Translations
          </h2>
          <p className="font-body text-base leading-relaxed text-stone-500 mb-12 max-w-2xl">
            Koinar uses multiple Bible translations. Full copyright notices are
            listed below as required by each publisher.
          </p>

          <div className="space-y-10">
            {SHIPPING_TRANSLATIONS.map((id) => {
              const citation = CITATIONS[id];
              return (
                <article
                  key={id}
                  id={`translation-${id.toLowerCase()}`}
                  className="border-t border-stone-200 pt-8 scroll-mt-20"
                >
                  <h3 className="font-display text-lg font-medium text-stone-900 mb-3">
                    {id}
                  </h3>
                  <p className="font-body text-base leading-relaxed text-stone-600 mb-3">
                    {citation.full}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    {citation.publisherLink && (
                      <a
                        href={citation.publisherLink.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-body text-base text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
                      >
                        {citation.publisherLink.label}
                      </a>
                    )}
                    {(id === "NLT" || id === "NIV" || id === "NASB") && (
                      <Link
                        href={`#api-${id.toLowerCase()}`}
                        className="font-body text-sm text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
                      >
                        How we deliver {id} →
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}

            {/* ESV is a sibling of the shipping list, not part of it — the
                citation registry's `full` string is a TODO stub until Crossway
                approval lands, so we render a deliberately minimal "coming
                soon" card instead of an invalid copyright block. */}
            <article
              id="translation-esv"
              className="border-t border-stone-200 pt-8 scroll-mt-20"
            >
              <h3 className="font-display text-lg font-medium text-stone-900 mb-3">
                ESV — English Standard Version{" "}
                <span className="ml-2 align-middle inline-block rounded-full bg-stone-200 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-stone-600">
                  Coming soon
                </span>
              </h3>
              <p className="font-body text-base leading-relaxed text-stone-600 mb-3">
                Pending approval from Crossway. When approved, ESV will be
                available alongside our other licensed translations, served
                directly via{" "}
                <a
                  href="https://api.esv.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-stone-700 transition-colors"
                >
                  api.esv.org
                </a>{" "}
                (not through API.Bible). Full copyright text will appear here
                when the license is finalised.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Scripture API */}
      <section
        id="scripture-api"
        className="bg-stone-50 px-8 py-16 md:px-14 md:py-20 xl:px-[100px] scroll-mt-20"
      >
        <div className="max-w-3xl">
          <div className="w-9 h-px bg-sage-300 mb-8" />
          <h2 className="font-display text-2xl md:text-3xl font-normal text-stone-900 mb-10">
            Scripture API
          </h2>

          <article className="border-t border-stone-200 pt-8">
            <h3 className="font-display text-lg font-medium text-stone-900 mb-2">
              Powered by API.Bible
            </h3>
            <p className="font-body text-base leading-relaxed text-stone-600">
              Licensed translations (NLT, NIV, NASB) are served via{" "}
              <a
                href="https://api.bible"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-stone-700 transition-colors"
              >
                API.Bible
              </a>{" "}
              under the Starter plan agreement. Fair-use monitoring is reported
              hourly via the{" "}
              <code className="font-mono text-[0.9em]">fums.api.bible</code>{" "}
              endpoint, per{" "}
              <a
                href="https://docs.api.bible/guides/fair-use/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-stone-700 transition-colors"
              >
                docs.api.bible/guides/fair-use
              </a>
              .
            </p>
          </article>

          {/* Per-translation routing. Readers clicking through from the
              Scripture Translations cards above land on the matching anchor
              here. Keep wording cross-referenced to that section so legal
              text + technical delivery read as one coherent story. */}
          <div className="mt-10 space-y-8">
            {API_ROUTING.map(({ id, name, blurb }) => (
              <article
                key={id}
                id={`api-${id.toLowerCase()}`}
                className="border-t border-stone-200 pt-8 scroll-mt-20"
              >
                <h3 className="font-display text-base font-medium text-stone-900 mb-2">
                  {name}
                </h3>
                <p className="font-body text-base leading-relaxed text-stone-600 mb-3">
                  {blurb}
                </p>
                <Link
                  href={`#translation-${id.toLowerCase()}`}
                  className="font-body text-sm text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
                >
                  ← See copyright notice
                </Link>
              </article>
            ))}

            <article
              id="api-esv"
              className="border-t border-stone-200 pt-8 scroll-mt-20"
            >
              <h3 className="font-display text-base font-medium text-stone-900 mb-2">
                ESV — served via api.esv.org (when approved)
              </h3>
              <p className="font-body text-base leading-relaxed text-stone-600 mb-3">
                If Crossway approves Koinar&apos;s ESV request, ESV content will
                be fetched directly from{" "}
                <a
                  href="https://api.esv.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-stone-700 transition-colors"
                >
                  api.esv.org
                </a>{" "}
                — a different upstream from NLT/NIV/NASB. ESV is not reported
                through FUMS (Crossway&apos;s API has its own usage reporting).
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Knowledge Graph Data Sources */}
      <section
        id="data-sources"
        className="bg-stone-100 px-8 py-16 md:px-14 md:py-20 xl:px-[100px] scroll-mt-20"
      >
        <div className="max-w-3xl">
          <div className="w-9 h-px bg-sage-300 mb-8" />
          <h2 className="font-display text-2xl md:text-3xl font-normal text-stone-900 mb-2">
            Knowledge Graph
          </h2>
          <p className="font-body text-base leading-relaxed text-stone-500 mb-12 max-w-2xl">
            Koinar&apos;s entity knowledge graph — people, places, cultures, time
            periods, and cross-references — is built on open scholarly data. We
            are grateful to the following projects.
          </p>

          <div className="space-y-10">
            <article className="border-t border-stone-200 pt-8">
              <h3 className="font-display text-lg font-medium text-stone-900 mb-2">
                STEPBible TIPNR Dataset
              </h3>
              <p className="font-body text-base leading-relaxed text-stone-600 mb-3">
                Translators Individualised Proper Names with all References, by Tyndale
                House, Cambridge. Licensed under{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-stone-700 transition-colors"
                >
                  CC BY 4.0
                </a>
                . Used for entity disambiguation, family relationships, and verse
                references. Names were matched to Strong&apos;s-suffixed identifiers and
                entity descriptions were extended with Koinar-generated summaries.
              </p>
              <a
                href="https://github.com/STEPBible/STEPBible-Data"
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-base text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
              >
                github.com/STEPBible/STEPBible-Data
              </a>
            </article>

            <article className="border-t border-stone-200 pt-8">
              <h3 className="font-display text-lg font-medium text-stone-900 mb-2">
                STEPBible TBESH / TBESG Lexicons
              </h3>
              <p className="font-body text-base leading-relaxed text-stone-600 mb-3">
                Hebrew and Greek brief definitions, by Tyndale House, Cambridge.
                Licensed under{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-stone-700 transition-colors"
                >
                  CC BY 4.0
                </a>
                . Used for original-language word meanings linked to Strong&apos;s numbers.
              </p>
              <a
                href="https://github.com/STEPBible/STEPBible-Data"
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-base text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
              >
                github.com/STEPBible/STEPBible-Data
              </a>
            </article>

            <article className="border-t border-stone-200 pt-8">
              <h3 className="font-display text-lg font-medium text-stone-900 mb-2">
                OpenBible.info Geocoding Data
              </h3>
              <p className="font-body text-base leading-relaxed text-stone-600 mb-3">
                Latitude/longitude coordinates of biblical places, by the OpenBible
                project. Licensed under{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-stone-700 transition-colors"
                >
                  CC BY 4.0
                </a>
                .
              </p>
              <a
                href="https://openbible.info/geo"
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-base text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
              >
                openbible.info/geo
              </a>
            </article>

            <article className="border-t border-stone-200 pt-8">
              <h3 className="font-display text-lg font-medium text-stone-900 mb-2">
                Treasury of Scripture Knowledge
              </h3>
              <p className="font-body text-base leading-relaxed text-stone-600 mb-3">
                Public-domain cross-references compiled from the 1830 work, enriched
                by OpenBible.info. Approximately 344,000 cross-references.
              </p>
              <a
                href="https://openbible.info/labs/cross-references"
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-base text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
              >
                openbible.info/labs/cross-references
              </a>
            </article>

            <article className="border-t border-stone-200 pt-8">
              <h3 className="font-display text-lg font-medium text-stone-900 mb-2">
                Strong&apos;s Concordance
              </h3>
              <p className="font-body text-base leading-relaxed text-stone-600">
                James Strong, 1890. Public domain. Used for Hebrew/Greek word tagging
                and original-language lookup.
              </p>
            </article>
          </div>

          <p className="font-body text-base leading-relaxed text-stone-500 mt-12 pt-8 border-t border-stone-200">
            Derivative works in the Koinar knowledge graph (entity descriptions,
            summaries, relationship labels) are our own and were generated with AI
            assistance and editorial review.
          </p>
        </div>
      </section>
    </main>
  );
}
