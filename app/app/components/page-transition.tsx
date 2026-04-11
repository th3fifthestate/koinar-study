"use client";

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ animation: "pageIn 700ms ease-out both" }}>
      {children}
    </div>
  );
}
