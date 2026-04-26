import type { Quote } from '@/lib/home/quote-rotation';

interface EditorialAsideProps {
  quote: Quote;
}

export function EditorialAside({ quote }: EditorialAsideProps) {
  return (
    <>
      <style>{`
        .colloquy {
          background: var(--bed-sage);
          padding: 110px 56px;
          text-align: center;
          position: relative;
        }
        @media (max-width: 768px) {
          .colloquy { padding: 72px 24px; }
        }
        .colloquy::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle at 20px 20px, var(--reader-accent-deep) 0.4px, transparent 0.6px);
          background-size: 100px 100px;
          opacity: 0.05;
          pointer-events: none;
        }
        .colloquy-inner {
          max-width: 760px;
          margin: 0 auto;
          position: relative;
        }
        .colloquy-mark {
          font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--reader-accent-deep);
          margin-bottom: 32px;
        }
        .colloquy-quote {
          font-family: var(--font-display), 'Bodoni Moda', Georgia, serif;
          font-style: italic;
          font-weight: 400;
          font-size: clamp(1.6rem, 2.8vw, 2.4rem);
          line-height: 1.25;
          color: var(--text-primary);
          margin: 0 0 30px;
          font-variation-settings: "opsz" 144;
        }
        .colloquy-rule {
          width: 56px;
          height: 1px;
          background: var(--warmth);
          margin: 0 auto 18px;
          opacity: 0.7;
        }
        .colloquy-attr {
          font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
          font-size: 9px;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--warmth);
          font-style: normal;
        }
      `}</style>
      <section className="colloquy" aria-label="Editorial aside">
        <div className="colloquy-inner">
          <div className="colloquy-mark">From the Editor</div>
          <blockquote>
            <p className="colloquy-quote">
              &#8220;{quote.body}&#8221;
            </p>
            <div className="colloquy-rule" aria-hidden="true" />
            <footer>
              <cite className="colloquy-attr">{quote.attribution}</cite>
            </footer>
          </blockquote>
        </div>
      </section>
    </>
  );
}
