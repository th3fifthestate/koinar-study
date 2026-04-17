import { getCurrentUser } from "@/lib/auth/session";
import { ContactForm } from "./contact-form";

export const metadata = {
  title: "Contact — Koinar",
  description: "Feedback, bug reports, and fact-check flags.",
};

export default async function ContactPage() {
  const user = await getCurrentUser();

  return (
    <main className="bg-stone-50 min-h-screen px-8 py-16 md:px-14 md:py-24 xl:px-[100px]">
      <div className="max-w-2xl mx-auto">
        <span className="font-body text-[0.75rem] font-semibold uppercase tracking-[0.3em] text-stone-400">
          Contact
        </span>
        <h1 className="mt-6 font-display text-[2.5rem] md:text-[3rem] font-normal leading-[1.1] text-stone-900">
          Tell us what you&rsquo;re thinking.
        </h1>
        <p className="mt-6 font-body text-base md:text-lg leading-relaxed text-stone-600 max-w-xl">
          Koinar is small and we read every message. Feedback, bug reports,
          and fact-check flags all land in the same inbox.
        </p>

        <div className="mt-12">
          <ContactForm
            initialName={user?.username ?? ""}
            initialEmail=""
            isLoggedIn={Boolean(user)}
          />
        </div>
      </div>
    </main>
  );
}
