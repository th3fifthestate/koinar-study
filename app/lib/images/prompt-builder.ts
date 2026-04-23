export type ImageStyle = "cinematic" | "classical" | "illustrated";

export type AspectRatio = "16:9" | "21:9" | "4:3";

const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "21:9": { width: 2560, height: 1080 },
  "4:3": { width: 1600, height: 1200 },
};

const STYLE_PREFIXES: Record<ImageStyle, string> = {
  cinematic:
    "Photorealistic cinematic scene, dramatic natural lighting, golden hour atmosphere, biblical-era ancient Near East setting, highly detailed costumes and architecture from 1st century Judea or ancient Mesopotamia, depth of field, volumetric light rays, dust particles in the air, earthy warm color palette, no text or lettering",
  classical:
    "Renaissance oil painting masterwork in the style of Caravaggio and Rembrandt, warm golden tones, dramatic chiaroscuro lighting, richly textured fabrics, biblical-era setting, museum-quality fine art, visible brushstrokes, ornate gilded frame atmosphere, no text or lettering",
  illustrated:
    "Modern editorial illustration in ink and watercolor style, loose expressive brushstrokes, limited warm color palette of ochre gold sienna and deep blue, biblical-era setting, slightly abstract background, editorial quality, contemporary art museum style, no text or lettering",
};

const NEGATIVE_PROMPT_SUFFIX =
  " Absolutely no modern clothing, no watches, no glasses, no modern hairstyles, no cars, no electronics, no plastic, no concrete buildings, no text overlays, no watermarks, no borders, no frames, no split panels.";

export function buildFluxPrompt(options: {
  studyTitle: string;
  sceneDescription: string;
  style: ImageStyle;
}): string {
  const stylePrefix = STYLE_PREFIXES[options.style];
  return `${stylePrefix}. Scene: ${options.sceneDescription}, depicting the subject of "${options.studyTitle}".${NEGATIVE_PROMPT_SUFFIX}`;
}

export function getDimensions(aspectRatio: AspectRatio): { width: number; height: number } {
  return ASPECT_RATIO_DIMENSIONS[aspectRatio];
}

export function suggestSceneFromTitle(title: string): string {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes("abraham")) {
    return "An elderly patriarch standing on a hilltop under a vast starry night sky in the ancient Near East, arms spread wide, looking upward at countless stars, arid desert landscape stretching to the horizon";
  }
  if (lowerTitle.includes("moses")) {
    return "A weathered man in simple robes standing before a towering mountain peak with storm clouds and lightning at the summit, ancient Sinai desert, dramatic divine atmosphere";
  }
  if (lowerTitle.includes("david")) {
    return "A young shepherd with a sling standing in rolling green hills of ancient Judea, sheep grazing nearby, a distant fortified city on a hilltop, warm afternoon light";
  }
  if (lowerTitle.includes("paul") || lowerTitle.includes("apostle")) {
    return "A traveler on an ancient Roman road stretching toward a Mediterranean coastal city, dusty path, olive groves, warm sunset light illuminating stone arches in the distance";
  }
  if (lowerTitle.includes("ruth")) {
    return "A young woman gleaning grain in a golden wheat field at harvest time, ancient Bethlehem in the background on a hillside, warm late afternoon light, other workers in the field";
  }
  if (lowerTitle.includes("sermon on the mount")) {
    return "A large crowd seated on a grassy Galilean hillside listening to a teacher standing above them, Sea of Galilee visible in the background, wildflowers, soft golden light";
  }
  if (lowerTitle.includes("psalm 23") || lowerTitle.includes("shepherd")) {
    return "A shepherd leading a small flock through a lush green valley with a gentle stream, rocky hills on either side, soft morning mist, ancient Judean landscape";
  }
  if (lowerTitle.includes("creation") || lowerTitle.includes("genesis 1")) {
    return "Primordial landscape of earth emerging from waters, dramatic light breaking through dark clouds, lush vegetation appearing, birds in flight, cosmic sense of beginning and order from chaos";
  }
  if (lowerTitle.includes("romans")) {
    return "Ancient Roman cityscape with a Jewish synagogue and Roman architecture side by side, sunrise breaking over the city, scrolls and letters visible, Mediterranean atmosphere";
  }
  if (lowerTitle.includes("prayer")) {
    return "A solitary figure kneeling in an ancient stone room, early morning light streaming through a window, oil lamp burning, simple clay vessels, atmosphere of quiet devotion";
  }
  if (lowerTitle.includes("covenant")) {
    return "An ancient altar of uncut stones in an open field, smoke rising from a sacrifice, a rainbow in the sky, vast landscape stretching in all directions, sense of divine promise";
  }
  if (lowerTitle.includes("kingdom")) {
    return "A great feast table set outdoors in an ancient garden, people of many nations gathered, grapevines and olive trees, warm lantern light, atmosphere of joy and abundance";
  }
  if (lowerTitle.includes("maccab")) {
    return "Ancient Jewish warriors reclaiming a grand stone temple, menorah being re-lit with golden flames, dramatic shadows and torchlight, Hellenistic architecture visible in the background";
  }
  if (lowerTitle.includes("holy spirit")) {
    return "Flames of fire descending into an upper room filled with gathered people, faces illuminated with awe, ancient Jerusalem visible through an open window, dramatic divine atmosphere";
  }

  return "An open ancient scroll on a wooden table in a stone room, oil lamp casting warm light, through the window a view of ancient Jerusalem at dawn, scholarly atmosphere of deep study";
}

export function getStyleOptions(): Array<{
  value: ImageStyle;
  label: string;
  description: string;
}> {
  return [
    {
      value: "cinematic",
      label: "Cinematic",
      description: "Photorealistic, dramatic lighting, biblical-era setting",
    },
    {
      value: "classical",
      label: "Classical",
      description: "Renaissance oil painting style, warm tones, chiaroscuro",
    },
    {
      value: "illustrated",
      label: "Illustrated",
      description: "Modern ink and watercolor, editorial quality",
    },
  ];
}

export function getAspectRatioOptions(): Array<{
  value: AspectRatio;
  label: string;
  dimensions: string;
}> {
  return [
    { value: "16:9", label: "Standard (16:9)", dimensions: "1920x1080" },
    { value: "21:9", label: "Ultrawide (21:9)", dimensions: "2560x1080" },
    { value: "4:3", label: "Classic (4:3)", dimensions: "1600x1200" },
  ];
}
