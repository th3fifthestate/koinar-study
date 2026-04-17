// app/components/global/ApiBibleCredit.tsx
export function ApiBibleCredit() {
  return (
    <p className="text-center text-[0.7rem] text-muted-foreground/50 py-3">
      Scripture text provided by{' '}
      <a
        href="https://api.bible"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
      >
        API.Bible
      </a>
    </p>
  );
}
