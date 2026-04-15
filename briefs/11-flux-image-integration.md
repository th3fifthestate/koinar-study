# Brief 11: Flux API Image Generation Integration

**Recommended mode: Direct Execution**

> **Branch:** All work on `develop`. Commit when complete with message: `Brief 11: Flux images — Pro/Max generation, admin preview workflow, R2 upload`
> **Path note:** This project uses `app/` not `app/src/`. **All `/src/` paths in this brief should be read as `/app/` in the filesystem.**

---

## ⚠️ Pre-Implementation Notes (April 15, 2026)

Readiness audit performed before Phase 4 execution. The codebase is partially prepared for this brief — some infrastructure exists, other parts need correction or reconciliation.

### Already in place (do NOT recreate)

- ✅ `lib/config.ts` — exposes `config.r2.*` (accountId, accessKeyId, secretAccessKey, bucketName, publicUrl) and `config.ai.fluxApiKey`
- ✅ `lib/env.ts` — validates `FLUX_API_KEY` and R2 env vars for production
- ✅ `@aws-sdk/client-s3` — already in `package.json`
- ✅ `lib/auth/middleware.ts` — exports `requireAdmin()`. **Use this, not `getSession()?.user?.isAdmin`** (the pattern shown throughout this brief does not match our codebase).
- ✅ Admin route group exists at `app/admin/` with layout.tsx
- ✅ `study_images` table exists in schema (but needs additive migration — see below)
- ✅ `featured_image_url` is already derived in `getStudyList`/`getStudyDetail` queries via subquery on `study_images` ordered by `sort_order`

### Five issues to resolve during implementation

**1. Schema mismatch — `study_images` table.** The existing schema (`lib/db/schema.ts` lines 138-146) differs from what this brief expects:

```sql
-- EXISTING (Brief 02):
CREATE TABLE study_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,         -- brief calls this `url`
  caption TEXT,                    -- not in brief
  sort_order INTEGER NOT NULL DEFAULT 0,
  flux_prompt TEXT,                -- brief wants NOT NULL
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Brief 11 assumes TEXT UUID primary keys and requires additional columns: `r2_key`, `style`, `aspect_ratio`, `width`, `height`, `size_bytes`, `is_hero`, `flux_task_id`, `created_by`.

**Recommended approach:** keep INTEGER PK (consistent with the rest of our schema), keep `image_url` as the column name (or alias to `url` in queries), and add the new columns via additive migration. Update any code using `crypto.randomUUID()` for IDs to use AUTOINCREMENT instead. The `caption` column can stay — it's useful for alt text.

**2. Auth pattern mismatch.** This brief shows `getSession()?.user?.isAdmin` throughout — that pattern does not exist in our codebase. **Replace with:**

```ts
import { requireAdmin } from "@/lib/auth/middleware";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  // ... use auth.user.userId, auth.user.isAdmin
}
```

**3. `FLUX_API_URL` bug.** In Section 1 (`flux.ts`), `submitGenerationTask` references a non-existent `FLUX_API_URL` constant. The brief defines `FLUX_API_URLS` (plural, keyed by model) but the fetch call uses the singular. Must pick the URL based on `request.model ?? 'flux-2-pro'` like:

```ts
const url = FLUX_API_URLS[request.model ?? 'flux-2-pro'];
const response = await fetch(url, { ... });
```

**4. Base64 JSON response is risky.** The `/api/admin/images/generate` route returns the full raw image as base64 in JSON. For a 1920x1080 PNG this can be 5-10 MB → ~13 MB base64, doubling memory pressure on both client and server. **Acceptable for v1** (admin-only, low frequency) but flag for optimization if it becomes a bottleneck. Alternative: write to a short-lived temp location in R2 under `previews/`, return a signed URL, and delete on reject/accept.

**5. Path prefix.** Every `/src/` path in this brief corresponds to our `/app/` filesystem. When the brief says `/src/lib/images/flux.ts`, create `app/lib/images/flux.ts`.

### Not yet installed

- `sharp` — run `npm install sharp` then add to `serverExternalPackages` in `next.config.ts` (currently `["better-sqlite3", "argon2"]`).
- No `seasonal_images` table yet — brief creates it via the migration.

### Known risk

- **Custom server + Node.js 24 issue** (carried over from Brief 08a): `tsx watch server.ts` crashes on Node.js 24 with an `AsyncLocalStorage` error. Brief 11 is pure API/admin-page code — no WebSocket interaction — so should work fine. But verify the dev server starts before committing.

---

## Context

You are adding AI-powered image generation to the Bible study community app. Admin users can trigger image generation for studies using the Black Forest Labs Flux 2 Pro (default) or Flux 2 Max (optional for hero/featured images) API, then upload results to Cloudflare R2 for serving. This is NOT auto-generated -- it is admin-curated for quality control. Cost is ~$0.03-0.06/image (Pro) or ~$0.15-0.25/image (Max).

Before starting, read these files for full context:
- `/Users/davidgeorge/Desktop/study-app/founders-files/DESIGN-DECISIONS.md` -- all confirmed architecture decisions
- `/Users/davidgeorge/Documents/bible-study-skills/skills/bible-reference/SKILL.md` -- study generation protocol

The project lives at `/Users/davidgeorge/Desktop/study-app/app/`. All file paths below are relative to that root unless specified as absolute.

---

## 1. Flux API Client

Create `/src/lib/images/flux.ts`:

```ts
import { config } from "@/lib/config";

interface FluxGenerateRequest {
  prompt: string;
  width?: number;
  height?: number;
  model?: "flux-2-pro" | "flux-2-max";  // default: "flux-2-pro"
}

interface FluxTaskResponse {
  id: string;
  status: "Pending" | "Ready" | "Error" | "Content Moderated" | "Request Moderated" | "Task not found";
  result?: {
    sample: string; // URL to the generated image
  };
}

const FLUX_API_URLS = {
  "flux-2-pro": "https://api.bfl.ml/v1/flux-2-pro",
  "flux-2-max": "https://api.bfl.ml/v1/flux-2-max",
} as const;
const FLUX_RESULT_URL = "https://api.bfl.ml/v1/get_result";
const MAX_POLL_ATTEMPTS = 120; // 2 minutes at 1-second intervals
const POLL_INTERVAL_MS = 1000;

export class FluxApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public fluxStatus?: string
  ) {
    super(message);
    this.name = "FluxApiError";
  }
}

/**
 * Submit an image generation request to Flux 2 Pro.
 * Returns a task ID for polling.
 */
async function submitGenerationTask(request: FluxGenerateRequest): Promise<string> {
  const apiKey = config.ai.fluxApiKey;
  if (!apiKey) {
    throw new FluxApiError("FLUX_API_KEY is not configured");
  }

  const body = {
    prompt: request.prompt,
    width: request.width ?? 1920,
    height: request.height ?? 1080,
  };

  const response = await fetch(FLUX_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    throw new FluxApiError(
      "Flux API rate limit reached (max 24 concurrent requests). Try again shortly.",
      429
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new FluxApiError(
      `Flux API request failed: ${response.status} ${errorText}`,
      response.status
    );
  }

  const data = await response.json();
  if (!data.id) {
    throw new FluxApiError("Flux API did not return a task ID");
  }

  return data.id;
}

/**
 * Poll for the result of a Flux generation task.
 * Returns the image URL when ready.
 */
async function pollForResult(taskId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const response = await fetch(`${FLUX_RESULT_URL}?id=${taskId}`, {
      headers: {
        "x-key": config.ai.fluxApiKey,
      },
    });

    if (!response.ok) {
      throw new FluxApiError(
        `Flux polling failed: ${response.status}`,
        response.status
      );
    }

    const data: FluxTaskResponse = await response.json();

    switch (data.status) {
      case "Ready":
        if (!data.result?.sample) {
          throw new FluxApiError("Flux returned Ready status but no image URL");
        }
        return data.result.sample;

      case "Pending":
        // Still processing, wait and try again
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        break;

      case "Content Moderated":
        throw new FluxApiError(
          "Image generation was blocked by content moderation. Try a different prompt.",
          undefined,
          "Content Moderated"
        );

      case "Request Moderated":
        throw new FluxApiError(
          "Request was blocked by moderation. Try a different prompt.",
          undefined,
          "Request Moderated"
        );

      case "Error":
        throw new FluxApiError("Flux API returned an error during generation");

      case "Task not found":
        throw new FluxApiError("Flux task not found. It may have expired.");

      default:
        throw new FluxApiError(`Unknown Flux status: ${data.status}`);
    }
  }

  throw new FluxApiError(
    `Flux generation timed out after ${MAX_POLL_ATTEMPTS} seconds`
  );
}

/**
 * Download an image from a URL and return it as a Buffer.
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new FluxApiError(`Failed to download generated image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate an image using Flux 2 Pro or Flux 2 Max.
 * Submits the request, polls until complete, and returns the image as a Buffer.
 */
export async function generateImage(
  request: FluxGenerateRequest
): Promise<{ buffer: Buffer; taskId: string }> {
  const taskId = await submitGenerationTask(request);
  const imageUrl = await pollForResult(taskId);
  const buffer = await downloadImage(imageUrl);
  return { buffer, taskId };
}

/**
 * Generate multiple preview images for admin selection.
 * Returns 2-3 variations for the admin to choose from before committing to R2.
 */
export async function generatePreviews(
  request: FluxGenerateRequest,
  count: 2 | 3 = 3
): Promise<Array<{ buffer: Buffer; taskId: string; index: number }>> {
  const tasks = Array.from({ length: count }, (_, i) =>
    generateImage(request).then((result) => ({ ...result, index: i }))
  );
  return Promise.all(tasks);
}

/**
 * Estimate cost for a generation request.
 * Flux 2 Pro: ~$0.05/image, Flux 2 Max: ~$0.20/image.
 */
export function estimateCost(
  count: number = 1,
  model: "flux-2-pro" | "flux-2-max" = "flux-2-pro"
): {
  perImage: number;
  total: number;
  formatted: string;
} {
  const perImage = model === "flux-2-max" ? 0.20 : 0.05;
  const total = perImage * count;
  return {
    perImage,
    total,
    formatted: `$${total.toFixed(2)}`,
  };
}
```

**Important implementation notes:**
- The Flux API is asynchronous. You POST a request, get back a task ID, then poll a separate endpoint until `status === "Ready"`.
- The API URL uses `api.bfl.ml` (not `api.bfl.ai`). Double-check the current docs if this fails: https://docs.bfl.ml/
- Maximum 24 concurrent requests. The client should surface rate limit errors clearly.
- Images are returned as temporary URLs that expire. Download immediately after getting a "Ready" response.

---

## 2. R2 Upload Client

Create `/src/lib/images/r2.ts`:

```ts
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { config } from "@/lib/config";

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
  }
  return s3Client;
}

/**
 * Upload an image buffer to R2.
 * Returns the public URL.
 */
export async function uploadImageToR2(
  buffer: Buffer,
  key: string,
  contentType: string = "image/webp"
): Promise<string> {
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${config.r2.publicUrl}/${key}`;
}

/**
 * Delete an image from R2.
 */
export async function deleteImageFromR2(key: string): Promise<void> {
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
    })
  );
}

/**
 * List all images for a study.
 */
export async function listStudyImages(studyId: string): Promise<string[]> {
  const client = getS3Client();
  const prefix = `studies/${studyId}/`;

  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: config.r2.bucketName,
      Prefix: prefix,
    })
  );

  return (result.Contents ?? []).map((obj) => obj.Key!).filter(Boolean);
}

/**
 * Generate the R2 key (path) for a study image.
 */
export function makeImageKey(
  studyId: string,
  imageId: string,
  extension: string = "webp"
): string {
  return `studies/${studyId}/${imageId}.${extension}`;
}
```

**WebP conversion:** If the Flux API returns PNG/JPEG, convert to WebP before uploading. Use the `sharp` package for this. Add it to the project:

```bash
npm install sharp
npm install -D @types/sharp
```

Then add a conversion utility to the same file:

```ts
import sharp from "sharp";

/**
 * Convert an image buffer to WebP format.
 * Returns the WebP buffer and its size in bytes.
 */
export async function convertToWebP(
  inputBuffer: Buffer,
  options?: { quality?: number; width?: number; height?: number }
): Promise<{ buffer: Buffer; sizeBytes: number }> {
  let pipeline = sharp(inputBuffer);

  if (options?.width || options?.height) {
    pipeline = pipeline.resize(options.width, options.height, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const webpBuffer = await pipeline
    .webp({ quality: options?.quality ?? 85 })
    .toBuffer();

  return { buffer: webpBuffer, sizeBytes: webpBuffer.length };
}
```

Add `sharp` to `serverExternalPackages` in `next.config.ts`:

```ts
serverExternalPackages: ["better-sqlite3", "argon2", "sharp"],
```

---

## 3. Image Generation Prompt Builder

Create `/src/lib/images/prompt-builder.ts`:

```ts
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

/**
 * Build a Flux image prompt given study context and style preferences.
 */
export function buildFluxPrompt(options: {
  studyTitle: string;
  sceneDescription: string;
  style: ImageStyle;
}): string {
  const stylePrefix = STYLE_PREFIXES[options.style];
  const prompt = `${stylePrefix}. Scene: ${options.sceneDescription}, depicting the subject of "${options.studyTitle}".${NEGATIVE_PROMPT_SUFFIX}`;
  return prompt;
}

/**
 * Get the pixel dimensions for an aspect ratio.
 */
export function getDimensions(aspectRatio: AspectRatio): { width: number; height: number } {
  return ASPECT_RATIO_DIMENSIONS[aspectRatio];
}

/**
 * Generate a suggested scene description from study content.
 * This is a simple heuristic -- the admin page also offers an AI-powered
 * suggestion via the /api/admin/images/suggest-prompt endpoint.
 */
export function suggestSceneFromTitle(title: string): string {
  // Basic keyword-based scene suggestions
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

  // Default: a generic scholarly biblical scene
  return "An open ancient scroll on a wooden table in a stone room, oil lamp casting warm light, through the window a view of ancient Jerusalem at dawn, scholarly atmosphere of deep study";
}

/**
 * Get all available style options with descriptions for the admin UI.
 */
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

/**
 * Get all available aspect ratio options for the admin UI.
 */
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
```

**AI-powered prompt suggestion:** In addition to the heuristic `suggestSceneFromTitle`, create an API route that uses Claude to generate a better Flux prompt from the study's actual content. See step 6 below for the route.

---

## 4. Database Schema Addition

Add an image-related table to the app database. If Brief 02 has already created the schema, add this migration. If not, add these CREATE TABLE statements to the schema file (`/src/lib/db/schema.ts`):

```sql
CREATE TABLE IF NOT EXISTS study_images (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  url TEXT NOT NULL,
  flux_prompt TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'cinematic',
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  width INTEGER NOT NULL DEFAULT 1920,
  height INTEGER NOT NULL DEFAULT 1080,
  size_bytes INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_hero INTEGER NOT NULL DEFAULT 0,
  flux_task_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_study_images_study ON study_images(study_id, sort_order);

CREATE TABLE IF NOT EXISTS seasonal_images (
  id TEXT PRIMARY KEY,
  season TEXT NOT NULL CHECK(season IN ('spring', 'summer', 'autumn', 'winter')),
  r2_key TEXT NOT NULL,
  url TEXT NOT NULL,
  flux_prompt TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'cinematic',
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Generate IDs using `crypto.randomUUID()`.

---

## 5. Seasonal Image Functions

Create `/src/lib/images/seasonal.ts`:

```ts
import { ImageStyle } from "./prompt-builder";

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

/**
 * Get the seasonal prompt for a given season and style.
 */
export function getSeasonalPrompt(season: Season, style: ImageStyle): string {
  const theme = SEASONAL_THEMES.find((t) => t.season === season);
  if (!theme) {
    throw new Error(`Unknown season: ${season}`);
  }
  return theme.prompts[style];
}

/**
 * Determine the current liturgical/calendar season.
 */
export function getCurrentSeason(): Season {
  const month = new Date().getMonth(); // 0-indexed
  if (month >= 2 && month <= 4) return "spring"; // Mar-May
  if (month >= 5 && month <= 7) return "summer"; // Jun-Aug
  if (month >= 8 && month <= 10) return "autumn"; // Sep-Nov
  return "winter"; // Dec-Feb
}
```

---

## 6. API Routes

### POST /api/admin/images/generate

Create `/src/app/api/admin/images/generate/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateImage, estimateCost } from "@/lib/images/flux";
import { buildFluxPrompt, getDimensions, type ImageStyle, type AspectRatio } from "@/lib/images/prompt-builder";
import { z } from "zod";

const generateSchema = z.object({
  studyId: z.string(),
  prompt: z.string().min(10).max(2000),
  style: z.enum(["cinematic", "classical", "illustrated"]),
  aspectRatio: z.enum(["16:9", "21:9", "4:3"]),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { studyId, prompt, style, aspectRatio } = parsed.data;
  const dimensions = getDimensions(aspectRatio as AspectRatio);
  const cost = estimateCost(1);

  try {
    const { buffer, taskId } = await generateImage({
      prompt,
      width: dimensions.width,
      height: dimensions.height,
    });

    // Return the raw image as base64 for preview (not yet uploaded to R2)
    const base64 = buffer.toString("base64");

    return NextResponse.json({
      success: true,
      preview: `data:image/png;base64,${base64}`,
      taskId,
      estimatedCost: cost.formatted,
      sizeBytes: buffer.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### POST /api/admin/images/attach

Create `/src/app/api/admin/images/attach/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { uploadImageToR2, convertToWebP, makeImageKey } from "@/lib/images/r2";
import { getDb } from "@/lib/db/connection";
import { z } from "zod";
import crypto from "crypto";

const attachSchema = z.object({
  studyId: z.string(),
  imageBase64: z.string(), // base64-encoded image data (without data: prefix)
  fluxPrompt: z.string(),
  style: z.string(),
  aspectRatio: z.string(),
  width: z.number(),
  height: z.number(),
  isHero: z.boolean().optional().default(false),
  fluxTaskId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = attachSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const imageId = crypto.randomUUID();
  const rawBuffer = Buffer.from(data.imageBase64, "base64");

  // Convert to WebP for smaller file sizes
  const { buffer: webpBuffer, sizeBytes } = await convertToWebP(rawBuffer);

  // Upload to R2
  const r2Key = makeImageKey(data.studyId, imageId);
  const url = await uploadImageToR2(webpBuffer, r2Key);

  // Get current max sort order for this study
  const db = getDb();
  const maxOrder = db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) as max_order FROM study_images WHERE study_id = ?")
    .get(data.studyId) as { max_order: number };

  // Insert record
  db.prepare(`
    INSERT INTO study_images (id, study_id, r2_key, url, flux_prompt, style, aspect_ratio, width, height, size_bytes, sort_order, is_hero, flux_task_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    imageId,
    data.studyId,
    r2Key,
    url,
    data.fluxPrompt,
    data.style,
    data.aspectRatio,
    data.width,
    data.height,
    sizeBytes,
    maxOrder.max_order + 1,
    data.isHero ? 1 : 0,
    data.fluxTaskId ?? null,
    session.user.id
  );

  // If this is marked as hero, unset any other hero images for this study
  if (data.isHero) {
    db.prepare(
      "UPDATE study_images SET is_hero = 0 WHERE study_id = ? AND id != ?"
    ).run(data.studyId, imageId);
  }

  return NextResponse.json({
    success: true,
    image: { id: imageId, url, r2Key, sizeBytes },
  });
}
```

### DELETE /api/admin/images/[id]/route.ts

Create `/src/app/api/admin/images/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { deleteImageFromR2 } from "@/lib/images/r2";
import { getDb } from "@/lib/db/connection";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  // Get the image record
  const image = db
    .prepare("SELECT * FROM study_images WHERE id = ?")
    .get(id) as { id: string; r2_key: string } | undefined;

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  // Delete from R2
  try {
    await deleteImageFromR2(image.r2_key);
  } catch (error) {
    console.error("Failed to delete from R2:", error);
    // Continue to delete the database record even if R2 deletion fails
  }

  // Delete from database
  db.prepare("DELETE FROM study_images WHERE id = ?").run(id);

  return NextResponse.json({ success: true });
}
```

### PUT /api/admin/images/reorder

Create `/src/app/api/admin/images/reorder/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { z } from "zod";

const reorderSchema = z.object({
  studyId: z.string(),
  imageIds: z.array(z.string()), // Ordered list of image IDs
});

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { studyId, imageIds } = parsed.data;
  const db = getDb();

  const updateStmt = db.prepare(
    "UPDATE study_images SET sort_order = ? WHERE id = ? AND study_id = ?"
  );

  const transaction = db.transaction(() => {
    imageIds.forEach((imageId, index) => {
      updateStmt.run(index, imageId, studyId);
    });
  });

  transaction();

  return NextResponse.json({ success: true });
}
```

### POST /api/admin/images/suggest-prompt

Create `/src/app/api/admin/images/suggest-prompt/route.ts`:

This route uses Claude to generate a Flux prompt from study content:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const suggestSchema = z.object({
  studyTitle: z.string(),
  studyContent: z.string().max(4000), // First ~4000 chars of the study
  style: z.enum(["cinematic", "classical", "illustrated"]),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = suggestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { studyTitle, studyContent, style } = parsed.data;

  const styleInstructions: Record<string, string> = {
    cinematic: "photorealistic cinematic with dramatic natural lighting and biblical-era ancient Near East setting",
    classical: "Renaissance oil painting with warm golden tones and dramatic chiaroscuro",
    illustrated: "modern editorial ink and watercolor illustration with a limited warm color palette",
  };

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `You are an expert at writing image generation prompts for the Flux AI model. Given a Bible study title and excerpt, generate a vivid scene description that would make a compelling hero image. The image should be ${styleInstructions[style]}.

Rules:
- Describe a SINGLE specific scene, not abstract concepts
- Include setting details (time of day, landscape, architecture)
- Include atmospheric details (lighting, mood, weather)
- Be historically accurate to the biblical era (no anachronisms)
- Do not include text, watermarks, or lettering in the scene
- Do not describe human faces in detail (keep figures at medium/far distance or from behind)
- Keep the prompt under 200 words
- Output ONLY the scene description, no preamble or explanation`,
    prompt: `Study title: "${studyTitle}"\n\nExcerpt:\n${studyContent.slice(0, 3000)}`,
    maxTokens: 300,
  });

  return NextResponse.json({ suggestedPrompt: text.trim() });
}
```

---

## 7. Admin Image Generation Page

Create `/src/app/(admin)/admin/images/page.tsx`:

Build a full admin page with these sections:

**Layout:**
- Page title: "Image Generation"
- Study selector (dropdown or searchable combobox that queries studies from the database)
- When a study is selected, show:
  - Auto-suggested prompt (fetched from the `/api/admin/images/suggest-prompt` endpoint), displayed in an editable textarea
  - Style preset selector (radio group or segmented control): Cinematic, Classical, Illustrated
  - Aspect ratio selector: 16:9, 21:9, 4:3
  - Estimated cost display: "Estimated cost: $0.06"
  - "Generate Preview" button
- After generation:
  - Large preview of the generated image
  - Buttons: "Accept & Attach to Study" | "Regenerate" | "Edit Prompt & Regenerate"
  - Checkbox: "Set as hero image"
- Below the generator, show existing images for the selected study:
  - Grid of image thumbnails
  - Drag-to-reorder support (use a simple drag handle, or arrow buttons for accessibility)
  - Each image shows: thumbnail, prompt used, style, dimensions, size, created date
  - Delete button on each image (with confirmation dialog)

**State management:**
- Use React `useState` for all local state
- Use `fetch` calls to the API routes above
- Show loading spinners during generation (generation can take 10-30 seconds)
- Show error messages clearly if generation fails
- Toast notifications (via `sonner`) for success/error feedback

**Seasonal Images Section:**
- Below the study images section, add a "Seasonal Backgrounds" section
- Grid showing current seasonal images (if any)
- Dropdown to select a season
- Style selector
- "Generate Seasonal Image" button
- "Set as Active Background" toggle

**Component structure suggestion:**
```
admin/images/page.tsx          -- page container, study selector
components/admin/
  image-generator.tsx          -- prompt editor, style/ratio selectors, generate button
  image-preview.tsx            -- generated image preview with accept/regenerate actions
  image-gallery.tsx            -- existing images grid with reorder/delete
  seasonal-generator.tsx       -- seasonal image section
```

Use shadcn/ui components throughout: `Card`, `Button`, `Textarea`, `Select`, `Dialog` (for delete confirmation), `Badge` (for style/ratio labels), `Skeleton` (for loading states).

---

## 8. Public Image Serving

For the study reader (implemented in a separate brief), images should be served from R2 via their public URLs. Add a helper to fetch a study's images:

Create `/src/lib/images/queries.ts`:

```ts
import { getDb } from "@/lib/db/connection";

export interface StudyImage {
  id: string;
  study_id: string;
  url: string;
  flux_prompt: string;
  style: string;
  aspect_ratio: string;
  width: number;
  height: number;
  size_bytes: number | null;
  sort_order: number;
  is_hero: boolean;
  created_at: string;
}

/**
 * Get all images for a study, ordered by sort_order.
 */
export function getStudyImages(studyId: string): StudyImage[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM study_images WHERE study_id = ? ORDER BY sort_order ASC"
    )
    .all(studyId) as Array<StudyImage & { is_hero: number }>;

  return rows.map((row) => ({
    ...row,
    is_hero: row.is_hero === 1,
  }));
}

/**
 * Get the hero image for a study (or the first image if no hero is set).
 */
export function getStudyHeroImage(studyId: string): StudyImage | null {
  const db = getDb();

  // Try hero first
  const hero = db
    .prepare(
      "SELECT * FROM study_images WHERE study_id = ? AND is_hero = 1 LIMIT 1"
    )
    .get(studyId) as (StudyImage & { is_hero: number }) | undefined;

  if (hero) return { ...hero, is_hero: true };

  // Fall back to first image by sort order
  const first = db
    .prepare(
      "SELECT * FROM study_images WHERE study_id = ? ORDER BY sort_order ASC LIMIT 1"
    )
    .get(studyId) as (StudyImage & { is_hero: number }) | undefined;

  return first ? { ...first, is_hero: first.is_hero === 1 } : null;
}

/**
 * Get the currently active seasonal background image.
 */
export function getActiveSeasonalImage(): { url: string; season: string } | null {
  const db = getDb();
  const row = db
    .prepare("SELECT url, season FROM seasonal_images WHERE is_active = 1 LIMIT 1")
    .get() as { url: string; season: string } | undefined;

  return row ?? null;
}
```

---

## Verification Steps

After completing all steps:

1. **Verify file structure exists:**
   - `/src/lib/images/flux.ts` -- Flux API client with submit, poll, download
   - `/src/lib/images/r2.ts` -- R2 upload, delete, list, WebP conversion
   - `/src/lib/images/prompt-builder.ts` -- prompt building, style presets, scene suggestions
   - `/src/lib/images/seasonal.ts` -- seasonal themes and prompts
   - `/src/lib/images/queries.ts` -- database queries for images
   - `/src/app/api/admin/images/generate/route.ts`
   - `/src/app/api/admin/images/attach/route.ts`
   - `/src/app/api/admin/images/[id]/route.ts`
   - `/src/app/api/admin/images/reorder/route.ts`
   - `/src/app/api/admin/images/suggest-prompt/route.ts`
   - `/src/app/(admin)/admin/images/page.tsx`

2. **Run `npm run build`** and confirm no TypeScript errors

3. **Verify the database migration** includes `study_images` and `seasonal_images` tables

4. **Verify `sharp` is in `serverExternalPackages`** in `next.config.ts`

5. **Verify the admin page renders** at `/admin/images` (auth may need to be bypassed for testing)

6. **Test cost display**: Shows model-specific cost — "$0.05" for Pro, "$0.20" for Max
7. **Model selector**: Switch between Flux 2 Pro and Flux 2 Max, verify different API endpoints are called
8. **Preview workflow**: "Generate Previews" creates 2-3 variations, admin selects one, only selected image uploads to R2
9. **Cost updates**: Preview count × model cost displayed correctly (e.g., 3 × $0.05 = "$0.15" for Pro previews)

---

## Important Notes

- All image generation is admin-triggered only. Users cannot generate images.
- Flux 2 Pro costs ~$0.05/image, Flux 2 Max costs ~$0.20/image. The cost display in the admin UI should show the estimate for the selected model before generation.
- R2 has a free tier with 10GB storage and no egress fees. Images are served directly from R2 via public URL.
- The Flux API URL may change. If `api.bfl.ml` does not work, check https://docs.bfl.ml/ for the current endpoint.
- Images should always be converted to WebP before upload to save storage and bandwidth.
- The `sharp` package requires native compilation. It is already handled by the Alpine base image in the Dockerfile (which includes build tools). Add it to `serverExternalPackages` so Next.js does not try to bundle it.
