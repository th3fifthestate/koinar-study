// app/lib/translations/citations.ts
//
// Short + full copyright text per translation.
//
//   - `short` is rendered in the reader footer on every licensed display.
//   - `full` is rendered on /about#scripture-translations (PR 2).
//   - NIV short MUST include `NIV®` (Biblica §VIII.B).
//
// IMPORTANT: The `full` strings MUST be copied VERBATIM from Appendix A of
// the API.Bible ToS PDF at founders-files/api-bible-docs/ and the NIV
// agreement for NIV. The placeholders below are operational stand-ins so
// PR 1 compiles and tests run — an engineer MUST paste the exact publisher
// notices before PR 2 ships the /about page. Do NOT paraphrase.

import type { TranslationId } from "./registry";

export interface CitationLink {
  label: string;
  url: string;
}

export interface Citation {
  short: string;
  full: string;
  publisherLink: CitationLink | null;
}

export const CITATIONS: Record<TranslationId, Citation> = {
  BSB: {
    short: "Berean Standard Bible (Public Domain)",
    full: "The Berean Standard Bible (BSB) is in the public domain. Text courtesy of berean.bible.",
    publisherLink: { label: "berean.bible", url: "https://berean.bible" },
  },
  KJV: {
    short: "King James Version (Public Domain)",
    full: "The King James Version (KJV) is in the public domain in the United States.",
    publisherLink: null,
  },
  WEB: {
    short: "World English Bible (Public Domain)",
    full: "The World English Bible (WEB) is in the public domain.",
    publisherLink: null,
  },
  // TODO(brief-13): replace BOTH `short` and `full` with the exact Appendix A
  // strings from the API.Bible ToS PDF (or NIV agreement for NIV) before PR 2
  // ships. The strings below are plausible boilerplate placeholders — they
  // have not been confirmed against the publisher-provided verbatim text.
  NLT: {
    short:
      "Scripture quotations are taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved.",
    full: "[TODO: paste verbatim NLT copyright block from API.Bible ToS Appendix A]",
    publisherLink: { label: "tyndale.com", url: "https://www.tyndale.com" },
  },
  // TODO(brief-13): replace BOTH `short` and `full` with the exact verbatim
  // strings from the NIV/Biblica agreement Appendix before PR 2 ships.
  // Placeholder preserves the ® symbol on first display (Biblica §VIII.B).
  NIV: {
    short:
      "Scripture quotations taken from The Holy Bible, New International Version® NIV®. Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.® Used by permission. All rights reserved worldwide.",
    full: "[TODO: paste verbatim NIV copyright block from Biblica agreement Appendix]",
    publisherLink: { label: "biblica.com", url: "https://www.biblica.com" },
  },
  // TODO(brief-13): replace BOTH `short` and `full` with the exact Appendix A
  // strings from the API.Bible ToS PDF before PR 2 ships.
  NASB: {
    short:
      "Scripture quotations taken from the New American Standard Bible® (NASB), Copyright © 1960, 1971, 1977, 1995 by The Lockman Foundation. Used by permission.",
    full: "[TODO: paste verbatim NASB 1995 copyright block from API.Bible ToS Appendix A]",
    publisherLink: { label: "lockman.org", url: "https://www.lockman.org" },
  },
  // TODO(brief-13): replace BOTH `short` and `full` with the exact strings
  // from the Crossway ESV license before PR 2 ships (only if ESV_API_KEY is
  // provisioned — otherwise ESV remains filtered out of the UI).
  ESV: {
    short:
      "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.",
    full: "[TODO: paste verbatim ESV copyright block from Crossway license]",
    publisherLink: { label: "esv.org", url: "https://www.esv.org" },
  },
};
