// app/app/(auth)/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Koinar",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-serif font-medium text-stone-800 tracking-wide">
          Koinar
        </h1>
        <p className="text-stone-500 text-sm mt-1">A community for Bible study</p>
      </div>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-stone-100 p-8">
        {children}
      </div>
    </div>
  );
}
