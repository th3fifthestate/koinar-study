// app/lib/translations/registry.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

function loadRegistry(overrides: Record<string, string>) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "test");
  for (const key of [
    "API_BIBLE_KEY",
    "ESV_API_KEY",
    "API_BIBLE_ID_NLT",
    "API_BIBLE_ID_NIV",
    "API_BIBLE_ID_NASB",
    "ABS_PURGE_ENABLED",
  ]) {
    vi.stubEnv(key, overrides[key] ?? "");
  }
  return import("./registry");
}

describe("getAvailableTranslations", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns only BSB when no keys configured", async () => {
    const { getAvailableTranslations } = await loadRegistry({});
    expect(getAvailableTranslations().map((t) => t.id)).toEqual(["BSB"]);
  });

  it("returns BSB + NLT/NIV/NASB when api-bible configured", async () => {
    const { getAvailableTranslations } = await loadRegistry({
      API_BIBLE_KEY: "k",
      API_BIBLE_ID_NLT: "nlt",
      API_BIBLE_ID_NIV: "niv",
      API_BIBLE_ID_NASB: "nasb",
    });
    expect(getAvailableTranslations().map((t) => t.id).sort()).toEqual(
      ["BSB", "NASB", "NIV", "NLT"],
    );
  });

  it("adds ESV when ESV_API_KEY set", async () => {
    const { getAvailableTranslations } = await loadRegistry({
      API_BIBLE_KEY: "k",
      API_BIBLE_ID_NLT: "nlt",
      API_BIBLE_ID_NIV: "niv",
      API_BIBLE_ID_NASB: "nasb",
      ESV_API_KEY: "esv",
    });
    expect(getAvailableTranslations().map((t) => t.id)).toContain("ESV");
  });

  it("omits NIV when its bible id is missing", async () => {
    const { getAvailableTranslations } = await loadRegistry({
      API_BIBLE_KEY: "k",
      API_BIBLE_ID_NLT: "nlt",
      API_BIBLE_ID_NASB: "nasb",
      // NIV id missing
    });
    expect(getAvailableTranslations().map((t) => t.id)).not.toContain("NIV");
  });

  it("returns only BSB when ABS_PURGE_ENABLED=true, even with keys set", async () => {
    const { getAvailableTranslations } = await loadRegistry({
      API_BIBLE_KEY: "k",
      API_BIBLE_ID_NLT: "nlt",
      API_BIBLE_ID_NIV: "niv",
      API_BIBLE_ID_NASB: "nasb",
      ESV_API_KEY: "esv",
      ABS_PURGE_ENABLED: "true",
    });
    expect(getAvailableTranslations().map((t) => t.id)).toEqual(["BSB"]);
  });
});

describe("export permissions", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("NIV exportAllowed is false (Biblica prohibits downloads)", async () => {
    const { TRANSLATIONS } = await loadRegistry({});
    expect(TRANSLATIONS.NIV.exportAllowed).toBe(false);
    expect(TRANSLATIONS.NIV.exportDisabledReason).toMatch(
      /NIV is available for in-app reading only/i,
    );
  });

  it("every non-NIV translation has exportAllowed=true", async () => {
    const { TRANSLATIONS } = await loadRegistry({});
    for (const t of Object.values(TRANSLATIONS)) {
      if (t.id === "NIV") continue;
      expect(t.exportAllowed).toBe(true);
      expect(t.exportDisabledReason).toBeUndefined();
    }
  });
});

describe("isExportAllowed", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("permits BSB export with no keys configured", async () => {
    const { isExportAllowed } = await loadRegistry({});
    expect(isExportAllowed("BSB")).toBe(true);
  });

  it("denies NIV export even when fully provisioned (per-translation flag)", async () => {
    const { isExportAllowed } = await loadRegistry({
      API_BIBLE_KEY: "k",
      API_BIBLE_ID_NIV: "niv",
    });
    expect(isExportAllowed("NIV")).toBe(false);
  });

  it("permits NLT export when api-bible is provisioned", async () => {
    const { isExportAllowed } = await loadRegistry({
      API_BIBLE_KEY: "k",
      API_BIBLE_ID_NLT: "nlt",
    });
    expect(isExportAllowed("NLT")).toBe(true);
  });

  it("fails closed for NLT under purge kill-switch", async () => {
    const { isExportAllowed } = await loadRegistry({
      API_BIBLE_KEY: "k",
      API_BIBLE_ID_NLT: "nlt",
      ABS_PURGE_ENABLED: "true",
    });
    expect(isExportAllowed("NLT")).toBe(false);
  });

  it("fails closed for NASB when its api-bible id is missing", async () => {
    const { isExportAllowed } = await loadRegistry({
      API_BIBLE_KEY: "k",
      // API_BIBLE_ID_NASB intentionally missing
    });
    expect(isExportAllowed("NASB")).toBe(false);
  });
});
