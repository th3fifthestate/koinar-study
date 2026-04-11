"use client";

export function ScrollHint() {
  return (
    <div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-2 opacity-0 flex flex-col items-center"
      style={{ animation: "fadeInHint 800ms ease-out 2.5s forwards" }}
    >
      <span className="font-body text-[0.6rem] font-medium uppercase tracking-[0.2em] text-[rgba(247,246,243,0.3)] mb-2.5">
        Scroll
      </span>
      <svg
        width="18"
        height="10"
        viewBox="0 0 18 10"
        fill="none"
        className="opacity-25"
        style={{ animation: "bobDown 3s ease-in-out infinite" }}
      >
        <path d="M1 1L9 9L17 1" stroke="#f7f6f3" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
