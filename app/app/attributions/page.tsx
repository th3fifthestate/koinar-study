import Link from "next/link";
import { CITATIONS } from "@/lib/translations/citations";
import { getAvailableTranslations } from "@/lib/translations/registry";
import type { TranslationId } from "@/lib/translations/registry";

export const metadata = {
  title: "Attributions — Koinar",
  description:
    "Scripture translations, Bible APIs, and knowledge graph data sources that Koinar is built on.",
};

export default function Attributions() {
  const availableIds = new Set(getAvailableTranslations().map((t) => t.id));
  const citationEntries = (
    Object.entries(CITATIONS) as [TranslationId, (typeof CITATIONS)[TranslationId]][]
  ).filter(
    ([id, c]) => availableIds.has(id) && !c.full.startsWith("[TODO"),
  );

  return (
    <main>
      {/* Hero */}
      <header className="bg-stone-50 px-8 py-16 md:px-14 md:py-24 xl:px-[100px]">
        <div className="max-w-3xl">
          <Link
            href="/"
            className="inline-block font-body text-sm text-stone-500 hover:text-stone-700 transition-colors mb-8"
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
            {citationEntries.map(([id, citation]) => (
              <article key={id} className="border-t border-stone-200 pt-8">
                <h3 className="font-display text-lg font-medium text-stone-900 mb-3">{id}</h3>
                <p className="font-body text-base leading-relaxed text-stone-600 mb-3">
                  {citation.full}
                </p>
                {citation.publisherLink && (
                  <a
                    href={citation.publisherLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-body text-sm text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
                  >
                    {citation.publisherLink.label}
                  </a>
                )}
              </article>
            ))}
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
                href="https://scripture.api.bible"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-stone-700 transition-colors"
              >
                API.Bible
              </a>{" "}
              under the Starter plan agreement.
            </p>
          </article>
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
                className="font-body text-sm text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
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
                className="font-body text-sm text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
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
                className="font-body text-sm text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
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
                className="font-body text-sm text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
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

          <p className="font-body text-sm leading-relaxed text-stone-400 mt-12 pt-8 border-t border-stone-200">
            Derivative works in the Koinar knowledge graph (entity descriptions,
            summaries, relationship labels) are our own and were generated with AI
            assistance and editorial review.
          </p>
        </div>
      </section>
    </main>
  );
}
