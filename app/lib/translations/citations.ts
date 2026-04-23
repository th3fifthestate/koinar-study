// app/lib/translations/citations.ts
//
// Short + full copyright text per translation.
//
//   - `short` is rendered in the reader footer on every licensed display.
//   - `full` is rendered on /attributions#scripture-translations.
//   - NIV MUST include `NIV®` (Biblica §VIII.B).
//
// The `full` strings below follow the Appendix A §A (Licensed) and §B (Public
// Domain) templates from the API.Bible ToS verbatim, with publisher name,
// year, abbreviation, and website slotted in per Appendix B. The BSB block
// is the §B Example 2 verbatim.
//
// ESV remains a TODO until Crossway access is granted (ESV_API_KEY). The
// registry filters ESV out of the UI unless the key is set.

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
    short: "Berean Standard Bible (BSB). Public domain.",
    full:
      "Scriptures quotations marked (BSB) are taken from the Berean Standard Bible. " +
      "The Holy Bible, Berean Standard Bible, BSB is produced in cooperation with " +
      "Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible Translation " +
      "Committee. This text of God's Word has been dedicated to the public domain. " +
      "Additional Information: https://berean.bible/",
    publisherLink: { label: "berean.bible", url: "https://berean.bible" },
  },
  KJV: {
    short: "King James Version (KJV). Public domain.",
    full:
      "Scriptures quotations marked (KJV) are taken from the King James Version, " +
      "which is in the public domain in the United States.",
    publisherLink: null,
  },
  WEB: {
    short: "World English Bible (WEB). Public domain.",
    full:
      "Scriptures quotations marked (WEB) are taken from the World English Bible, " +
      "which is in the public domain.",
    publisherLink: null,
  },
  NLT: {
    short: "NLT © 1996, 2004, 2015 Tyndale House Foundation. All rights reserved.",
    full:
      "Scriptures quotations marked (NLT) © are taken from the Holy Bible, New " +
      "Living Translation ©, Copyright 1996, 2004, 2015 by Tyndale House Foundation. " +
      "Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. " +
      "All rights reserved. The NLT text may not be quoted in any publication made " +
      "available to the public by a Creative Commons license. The NLT may not be " +
      "translated into any other language. Website: https://www.tyndale.com",
    publisherLink: { label: "tyndale.com", url: "https://www.tyndale.com" },
  },
  // NIV short preserves the ® symbol on first display (Biblica §VIII.B).
  NIV: {
    short:
      "NIV® © 1973, 1978, 1984, 2011 Biblica, Inc.® All rights reserved worldwide.",
    full:
      "Scriptures quotations marked (NIV) © are taken from the Holy Bible, New " +
      "International Version®, NIV® ©, Copyright 1973, 1978, 1984, 2011 by Biblica, " +
      "Inc.® Used by permission. All rights reserved worldwide. The NIV text may not " +
      "be quoted in any publication made available to the public by a Creative " +
      "Commons license. The NIV may not be translated into any other language. " +
      "Website: https://www.biblica.com",
    publisherLink: { label: "biblica.com", url: "https://www.biblica.com" },
  },
  NASB: {
    short:
      "NASB® © 1960, 1971, 1972, 1973, 1975, 1977, 1995 The Lockman Foundation. All rights reserved.",
    full:
      "Scriptures quotations marked (NASB) © are taken from the New American " +
      "Standard Bible®, NASB® ©, Copyright 1960, 1971, 1972, 1973, 1975, 1977, 1995 " +
      "by The Lockman Foundation. Used by permission. All rights reserved. The NASB " +
      "text may not be quoted in any publication made available to the public by a " +
      "Creative Commons license. The NASB may not be translated into any other " +
      "language. Website: https://www.lockman.org",
    publisherLink: { label: "lockman.org", url: "https://www.lockman.org" },
  },
  // TODO(brief-13): ESV citation pending Crossway application outcome. Only
  // exposed to users when ESV_API_KEY is provisioned; until then the registry
  // filters ESV out of the UI and this block is unreachable.
  ESV: {
    short:
      "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.",
    full: "[TODO: paste verbatim ESV copyright block from Crossway license]",
    publisherLink: { label: "esv.org", url: "https://www.esv.org" },
  },
};
