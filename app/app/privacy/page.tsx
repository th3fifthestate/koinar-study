import Link from "next/link";

export const metadata = {
  title: "Privacy — Koinar",
  description:
    "How Koinar handles your data during closed alpha. A full policy will ship before public launch.",
};

export default function PrivacyPage() {
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
            Privacy
          </span>
          <h1 className="mt-6 font-display text-[2.5rem] md:text-[3.25rem] font-normal leading-[1.1] text-stone-900">
            A short note about your data.
          </h1>
          <p className="mt-6 font-body text-base md:text-lg leading-relaxed text-stone-600 max-w-2xl">
            Koinar is in closed alpha. A full privacy policy will ship before
            public launch. Until then, the short version below is what we
            practice.
          </p>
        </div>
      </header>

      <section className="bg-stone-100 px-8 py-16 md:px-14 md:py-20 xl:px-[100px]">
        <div className="max-w-3xl space-y-10">
          <article>
            <div className="w-9 h-px bg-sage-300 mb-6" />
            <h2 className="font-display text-2xl md:text-3xl font-normal text-stone-900 mb-4">
              What we collect
            </h2>
            <ul className="font-body text-base leading-relaxed text-stone-600 space-y-2 list-disc pl-5">
              <li>Your account email and display name.</li>
              <li>
                Study content you read, annotate, generate, or clip within the
                app.
              </li>
              <li>Session cookies so you stay logged in across visits.</li>
              <li>
                Minimal request logs (timestamps, paths, errors) for keeping
                the app working.
              </li>
            </ul>
          </article>

          <article className="border-t border-stone-200 pt-10">
            <h2 className="font-display text-2xl md:text-3xl font-normal text-stone-900 mb-4">
              What we don&apos;t do
            </h2>
            <ul className="font-body text-base leading-relaxed text-stone-600 space-y-2 list-disc pl-5">
              <li>We don&apos;t sell your data.</li>
              <li>We don&apos;t share it with advertisers or data brokers.</li>
              <li>We don&apos;t use your study content to train AI models.</li>
            </ul>
          </article>

          <article className="border-t border-stone-200 pt-10">
            <h2 className="font-display text-2xl md:text-3xl font-normal text-stone-900 mb-4">
              Cookies &amp; storage
            </h2>
            <p className="font-body text-base leading-relaxed text-stone-600">
              Koinar uses a session cookie (to keep you signed in) and a CSRF
              token cookie (to protect account actions). That&apos;s it — no
              analytics, no advertising pixels, no third-party trackers. Your
              cookie preference itself is saved in your browser&apos;s
              localStorage under the key{" "}
              <code className="font-mono text-[0.9em] text-stone-800">
                koinar:cookies
              </code>
              . Clearing your browser&apos;s site data for koinar.app resets
              the banner and shows it again on the next visit.
            </p>
          </article>

          <article className="border-t border-stone-200 pt-10">
            <h2 className="font-display text-2xl md:text-3xl font-normal text-stone-900 mb-4">
              Your choices
            </h2>
            <p className="font-body text-base leading-relaxed text-stone-600">
              You can delete your account at any time — email{" "}
              <a
                href="mailto:hello@koinar.app"
                className="underline underline-offset-2 hover:text-stone-700 transition-colors"
              >
                hello@koinar.app
              </a>{" "}
              and we&apos;ll remove your account and its associated content.
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
              . This page will be replaced with a full policy before Koinar
              leaves alpha.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
