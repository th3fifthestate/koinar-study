import { AboutClient } from "./about-client";
import { CITATIONS } from "@/lib/translations/citations";
import { getAvailableTranslations } from "@/lib/translations/registry";
import type { TranslationId } from "@/lib/translations/registry";

export default function About() {
  // Only render citations for translations actually selectable right now —
  // this filters ESV (TODO placeholder) and any purge-disabled licensed
  // translations so we never show "[TODO: paste…]" to end users.
  const availableIds = new Set(getAvailableTranslations().map((t) => t.id));
  const citationEntries = (
    Object.entries(CITATIONS) as [TranslationId, (typeof CITATIONS)[TranslationId]][]
  ).filter(
    ([id, c]) => availableIds.has(id) && !c.full.startsWith("[TODO"),
  );

  return (
    <>
      <AboutClient />

      <section
        id="scripture-translations"
        className="bg-stone-100 px-8 py-16 md:px-14 md:py-20 xl:px-[100px]"
      >
        <div className="max-w-3xl">
          <div className="w-9 h-px bg-sage-300 mb-8" />
          <h2 className="font-display text-2xl font-normal text-stone-900 mb-2">
            Scripture Translations
          </h2>
          <p className="font-body text-sm text-stone-500 mb-12">
            Koinar uses multiple Bible translations. Full copyright notices are
            listed below as required by each publisher.
          </p>

          <div className="space-y-10">
            {citationEntries.map(([id, citation]) => (
              <div key={id} className="border-t border-stone-200 pt-8">
                <h3 className="font-display text-lg font-medium text-stone-900 mb-3">{id}</h3>
                <p className="font-body text-sm leading-relaxed text-stone-600 mb-3">
                  {citation.full}
                </p>
                {citation.publisherLink && (
                  <a
                    href={citation.publisherLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-stone-400 underline underline-offset-2 hover:text-stone-600 transition-colors"
                  >
                    {citation.publisherLink.label}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
