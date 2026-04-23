// app/lib/email/shell.ts
//
// Shared HTML shell for user-facing transactional emails. Keeps branding
// consistent across invite, verification, and approval flows.
//
// Email client constraints driving the choices here:
//   - Gmail strips <link> and most <style> tags → fonts & colors are
//     inlined; web fonts (Bodoni Moda / Literata) are referenced but
//     we assume they won't load and design the fallback (Georgia) to
//     carry the visual identity.
//   - Outlook rewrites margins on <div> → layout uses tables.
//   - iOS Mail / dark-mode clients can invert colors → we set an
//     explicit background-color on every colored surface.
//   - Preview text (the snippet shown in the inbox list) is set via
//     an invisible <span> at the top of the body.

const PALETTE = {
  background: "#f7f6f3", // --background
  foreground: "#2c2924", // --foreground
  card: "#ffffff",
  border: "#ddd9d0", // --border
  borderSubtle: "#edebe6", // --muted
  muted: "#edebe6",
  mutedFg: "#5c564a", // --muted-foreground
  primary: "#6b8060", // --primary (sage)
  primaryFg: "#f7f6f3", // --primary-foreground
};

const FONTS = {
  display: `Didot, 'Bodoni 72', 'Bodoni Moda', Georgia, serif`,
  body: `Georgia, 'Literata', 'Times New Roman', serif`,
  mono: `'SF Mono', 'Menlo', 'Consolas', 'Courier New', monospace`,
};

interface ShellOptions {
  /** Short sentence shown as the inbox preview snippet (hidden in body). */
  previewText: string;
  /** HTML body of the email (between header and footer). */
  body: string;
  /** Optional footer override; defaults to a generic Koinar line. */
  footer?: string;
}

export function renderEmailShell({
  previewText,
  body,
  footer,
}: ShellOptions): string {
  const defaultFooter = `
    You're receiving this because someone invited you to Koinar —
    Bible study in deep fellowship.<br />
    Questions? Reply to this email or write
    <a href="mailto:hello@koinar.app" style="color:${PALETTE.mutedFg};text-decoration:underline;">hello@koinar.app</a>.
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Koinar</title>
</head>
<body style="margin:0;padding:0;background-color:${PALETTE.background};color:${PALETTE.foreground};font-family:${FONTS.body};-webkit-font-smoothing:antialiased;">
  <span style="display:none !important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:${PALETTE.background};">
    ${escapeHtml(previewText)}
  </span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PALETTE.background};padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:${PALETTE.card};border:1px solid ${PALETTE.border};border-radius:8px;">
          <tr>
            <td style="padding:32px 40px 20px 40px;text-align:center;border-bottom:1px solid ${PALETTE.borderSubtle};">
              <span style="font-family:${FONTS.display};font-size:30px;font-weight:500;letter-spacing:0.12em;color:${PALETTE.foreground};text-transform:lowercase;">koinar</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;font-family:${FONTS.body};font-size:16px;line-height:1.65;color:${PALETTE.foreground};">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 28px 40px;border-top:1px solid ${PALETTE.borderSubtle};font-family:${FONTS.body};font-size:13px;line-height:1.6;color:${PALETTE.mutedFg};text-align:center;">
              ${footer ?? defaultFooter}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** A large sage CTA button. Render inside the shell `body`. */
export function renderEmailButton(options: {
  href: string;
  label: string;
}): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
      <tr>
        <td style="border-radius:6px;background-color:${PALETTE.primary};">
          <a href="${options.href}" style="display:inline-block;padding:14px 32px;font-family:${FONTS.body};font-size:15px;font-weight:500;color:${PALETTE.primaryFg};text-decoration:none;letter-spacing:0.03em;">
            ${escapeHtml(options.label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

/** A large, letter-spaced verification code in a muted panel. */
export function renderEmailCode(code: string): string {
  return `
    <div style="background-color:${PALETTE.muted};border-radius:8px;padding:24px 16px;margin:24px 0;text-align:center;">
      <div style="font-family:${FONTS.mono};font-size:30px;font-weight:600;letter-spacing:0.55em;color:${PALETTE.foreground};padding-left:0.55em;">
        ${escapeHtml(code)}
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Exposed so email-sending functions can escape user-provided strings
 * (names, study titles) before interpolating into the body HTML.
 */
export const escape = escapeHtml;
