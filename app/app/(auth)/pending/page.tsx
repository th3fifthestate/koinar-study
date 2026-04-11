// app/app/(auth)/pending/page.tsx
"use client";

import { useRouter } from "next/navigation";

export default function PendingPage() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="text-center space-y-4">
      <h2 className="text-xl font-medium text-stone-800">Account pending approval</h2>
      <p className="text-stone-500 text-sm leading-relaxed">
        We'll let you know when you're in.
      </p>
      <button
        onClick={handleLogout}
        className="text-sm text-stone-400 underline underline-offset-2 hover:text-stone-600"
      >
        Sign out
      </button>
    </div>
  );
}
