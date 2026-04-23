import Link from "next/link";

export const metadata = {
  title: "Terms — Koinar",
  description:
    "The short terms for using Koinar during closed alpha. Full terms of service will ship before public launch.",
};

export default function TermsPage() {
  return (
    <main>
      <header className="bg-stone-50 px-8 py-16 md:px-14 md:py-24 xl:px-[100px]">
        <div className="max-w-3xl">
          <Link
            href="/"
            className="block font-body text-sm text-stone-500 hover:text-stone-700 transition-colors mb-8"
          >
            ← Back
          </Link>
          <span className="font-body text-[0.75rem] font-semibold uppercase tracking-[0.3em] text-stone-400">
            Terms
          </span>
          <h1 className="mt-6 font-display text-[2.5rem] md:text-[3.25rem] font-normal leading-[1.1] text-stone-900">
            The short version, for now.
          </h1>
          <p className="mt-6 font-body text-base md:text-lg leading-relaxed text-stone-600 max-w-2xl">
            Koinar is in closed alpha and is provided as-is while we build.
            Full terms of service will ship before public launch.
          </p>
        </div>
      </header>

      <section className="bg-stone-100 px-8 py-16 md:px-14 md:py-20 xl:px-[100px]">
        <div className="max-w-3xl space-y-10">
          <article>
            <div className="w-9 h-px bg-sage-300 mb-6" />
            <h2 className="font-display text-2xl md:text-3xl font-normal text-stone-900 mb-4">
              By using Koinar, you accept that
            </h2>
            <ul className="font-body text-base leading-relaxed text-stone-600 space-y-2 list-disc pl-5">
              <li>
                Features may change, break, or be removed while we iterate.
              </li>
              <li>
                Your account is tied to an invitation and may be revoked if
                the account is misused.
              </li>
              <li>
                Bible-translation text is subject to each publisher&apos;s
                terms — see{" "}
                <Link
                  href="/attributions"
                  className="underline underline-offset-2 hover:text-stone-700 transition-colors"
                >
                  Attributions
                </Link>{" "}
                for the full roll call.
              </li>
              <li>
                Content you generate, clip, or annotate is yours; you grant
                Koinar the limited right to store and display it so the app
                works.
              </li>
            </ul>
          </article>

          <article className="border-t border-stone-200 pt-10">
            <h2 className="font-display text-2xl md:text-3xl font-normal text-stone-900 mb-4">
              What we ask of you
            </h2>
            <ul className="font-body text-base leading-relaxed text-stone-600 space-y-2 list-disc pl-5">
              <li>
                Don&apos;t try to break, scrape, or overload the service.
              </li>
              <li>Don&apos;t share your invitation or account with others.</li>
              <li>
                Be kind — this is a fellowship, not a feed.
              </li>
            </ul>
          </article>

          <article className="border-t border-stone-200 pt-10">
            <h2 className="font-display text-2xl md:text-3xl font-normal text-stone-900 mb-4">
              No warranties
            </h2>
            <p className="font-body text-base leading-relaxed text-stone-600">
              Koinar is offered as-is during alpha, without warranties of any
              kind. Use it as part of your study practice, not as a
              substitute for scholarly or pastoral counsel.
            </p>
          </article>

          <article className="border-t border-stone-200 pt-10">
            <h2 className="font-display text-2xl md:text-3xl font-normal text-stone-900 mb-4">
              Questions
            </h2>
            <p className="font-body text-base leading-relaxed text-stone-600">
              Write to{" "}
              <a
                href="mailto:hello@koinar.app"
                className="underline underline-offset-2 hover:text-stone-700 transition-colors"
              >
                hello@koinar.app
              </a>
              . Full terms will be posted here before public launch.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
