import type { ImageStyle } from "./prompt-builder";

export type Season = "spring" | "summer" | "autumn" | "winter";

interface SeasonalTheme {
  season: Season;
  label: string;
  description: string;
  prompts: Record<ImageStyle, string>;
}

export const SEASONAL_THEMES: SeasonalTheme[] = [
  {
    season: "spring",
    label: "Spring (Easter / Resurrection)",
    description: "Themes of new life, resurrection, and the empty tomb",
    prompts: {
      cinematic:
        "Photorealistic cinematic scene of an empty ancient rock-hewn tomb at dawn, the massive stone rolled away, brilliant golden sunrise light flooding in, garden with blooming flowers and olive trees outside, morning dew, volumetric light rays, hope and triumph atmosphere, no text or lettering, no figures",
      classical:
        "Renaissance oil painting of an empty garden tomb at sunrise, brilliant golden light breaking through, flowering garden, the stone rolled away, Easter morning atmosphere, warm golden palette, dramatic chiaroscuro, no text or lettering, no figures",
      illustrated:
        "Modern watercolor illustration of an empty tomb at dawn, loose expressive brushstrokes, golden and pink sunrise palette, blooming wildflowers, spring morning atmosphere, editorial art quality, no text or lettering, no figures",
    },
  },
  {
    season: "summer",
    label: "Summer (Growth / Mission)",
    description: "Themes of harvest fields, mission, and the spreading gospel",
    prompts: {
      cinematic:
        "Photorealistic cinematic scene of golden wheat fields stretching to the horizon under a brilliant blue sky, ancient pathway cutting through, a distant Mediterranean village, warm summer light, gentle breeze visible in the grain, abundance and mission atmosphere, no text or lettering",
      classical:
        "Renaissance oil painting of vast golden harvest fields with workers gathering grain, warm summer palette, brilliant blue sky, distant village, abundance atmosphere, Millet-inspired, no text or lettering",
      illustrated:
        "Modern watercolor illustration of golden wheat fields under bright blue sky, warm ochre and gold palette, loose expressive brushstrokes, simple ancient pathway, editorial art quality, no text or lettering",
    },
  },
  {
    season: "autumn",
    label: "Autumn (Harvest / Thanksgiving)",
    description: "Themes of harvest, gratitude, and the Feast of Tabernacles",
    prompts: {
      cinematic:
        "Photorealistic cinematic scene of an ancient harvest festival, wooden tables laden with grapes figs pomegranates and grain, autumn foliage in gold and crimson, rustic stone village, warm golden hour light, Sukkot booth with palm branches and citrus, abundance and gratitude atmosphere, no text or lettering",
      classical:
        "Renaissance oil painting of an abundant harvest feast, overflowing baskets of fruit and grain, autumn colors of gold crimson and amber, warm candlelight, rich textures, Caravaggio-inspired still life elements, no text or lettering",
      illustrated:
        "Modern watercolor illustration of autumn harvest with overflowing baskets of fruit, warm palette of crimson gold and amber, loose expressive brushstrokes, cozy gratitude atmosphere, editorial art quality, no text or lettering",
    },
  },
  {
    season: "winter",
    label: "Winter (Advent / Christmas)",
    description: "Themes of anticipation, the Incarnation, light in darkness",
    prompts: {
      cinematic:
        "Photorealistic cinematic scene of ancient Bethlehem at night, warm golden lamplight glowing from stone buildings, a single bright star in the dark sky, shepherds' field in the foreground with a distant fire, cold clear winter night, atmosphere of wonder and anticipation, no text or lettering",
      classical:
        "Renaissance oil painting of a quiet Bethlehem night scene, warm golden light from within a stone stable, a single brilliant star overhead, deep blue night sky, Rembrandt-inspired chiaroscuro, atmosphere of holy stillness and wonder, no text or lettering",
      illustrated:
        "Modern watercolor illustration of a starlit night over ancient Bethlehem, warm golden glow from stone buildings, deep indigo sky with one bright star, limited palette of gold and deep blue, editorial art quality, no text or lettering",
    },
  },
];

export function getSeasonalPrompt(season: Season, style: ImageStyle): string {
  const theme = SEASONAL_THEMES.find((t) => t.season === season);
  if (!theme) {
    throw new Error(`Unknown season: ${season}`);
  }
  return theme.prompts[style];
}

export function getCurrentSeason(): Season {
  const month = new Date().getMonth(); // 0-indexed
  if (month >= 2 && month <= 4) return "spring"; // Mar-May
  if (month >= 5 && month <= 7) return "summer"; // Jun-Aug
  if (month >= 8 && month <= 10) return "autumn"; // Sep-Nov
  return "winter"; // Dec-Feb
}
