/**
 * Generate the 6 time-of-day hero images for the authenticated home page.
 *
 * Per founders-files/brief-22a-plan.md §6 and brief-22a-amendments.md §6,
 * this produces a Flux-generated landscape per TOD bucket and uploads to R2
 * under /home-hero/{bucket}.webp. The home hero set must be visually distinct
 * from the landing-page image set (per the project_home_hero_images memory).
 *
 * Each prompt specifies biblical-era Near Eastern landscape, atmospheric time
 * of day, no figures, no text. Style is cinematic-photoreal — chosen to sit
 * underneath a Bodoni editorial lockup without competing with typography.
 *
 * Run: cd app && npx tsx scripts/generate-home-hero-images.ts [--bucket=dawn]
 *
 * Requires env: FLUX_API_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL.
 *
 * Cost: ~$0.04 per image × 6 = ~$0.24 per full run.
 */

import 'dotenv/config';
import { generateImage, FluxApiError } from '../lib/images/flux';
import { uploadImageToR2, convertToWebP } from '../lib/images/r2';

type Bucket = 'dawn' | 'morning' | 'midday' | 'golden' | 'evening' | 'night';

interface HeroSpec {
  bucket: Bucket;
  prompt: string;
}

const HERO_IMAGES: HeroSpec[] = [
  {
    bucket: 'dawn',
    prompt:
      'Photorealistic cinematic landscape, first light of dawn over a rocky Middle-Eastern hillside, pale cool sky turning to faint amber at the horizon, distant ridges silhouetted in blue-grey mist, a single olive tree in the foreground, dew on stone, biblical-era ancient Near East setting, no figures, no text, no lettering, wide aspect, painterly atmosphere, 16:9',
  },
  {
    bucket: 'morning',
    prompt:
      'Photorealistic cinematic landscape, mid-morning light through an olive grove in the Galilean hill country, long sharp shadows on terraced stone walls, warm green foliage, clear blue sky, biblical-era ancient Near East setting, no figures, no modern elements, no text, wide aspect, painterly atmosphere, 16:9',
  },
  {
    bucket: 'midday',
    prompt:
      'Photorealistic cinematic landscape, sun-bleached stone path winding through dry highlands at midday, sparse cypress trees on the ridge, pale washed-out sky, quiet heat haze rising from white limestone, biblical-era ancient Near East landscape, no figures, no structures, no text, wide aspect, hushed monochromatic palette, 16:9',
  },
  {
    bucket: 'golden',
    prompt:
      'Photorealistic cinematic landscape, late-afternoon golden hour over a valley of ripening wheat, honey-amber light raking sideways, long warm shadows across the field, distant olive trees against a sage hillside, biblical-era ancient Near East setting, no figures, no harvesters, no text, wide aspect, painterly atmosphere, 16:9',
  },
  {
    bucket: 'evening',
    prompt:
      'Photorealistic cinematic landscape, desert dusk over a silhouetted ridge line, purple-amber gradient sky fading to deep indigo, first stars faintly visible, warm orange afterglow along the horizon, dry valley floor in shadow, biblical-era ancient Near East setting, no figures, no campfire, no text, wide aspect, painterly atmosphere, 16:9',
  },
  {
    bucket: 'night',
    prompt:
      'Photorealistic cinematic landscape, clear starfield over dark hills in the Judean wilderness, deep navy sky rich with stars, faint warm amber glow along one horizon, dry earth and rock in cool moonlight, biblical-era ancient Near East setting, no figures, no campfire, no text, wide aspect, quiet contemplative atmosphere, 16:9',
  },
];

const WIDTH = 1920;
const HEIGHT = 1080;

interface Result {
  bucket: Bucket;
  ok: boolean;
  url?: string;
  error?: string;
  taskId?: string;
  sizeKb?: number;
}

async function generateOne(spec: HeroSpec): Promise<Result> {
  const label = `[${spec.bucket.padEnd(7)}]`;
  try {
    console.log(`${label} generating (Flux, 1920x1080)...`);
    const { buffer: pngBuffer, taskId } = await generateImage({
      prompt: spec.prompt,
      width: WIDTH,
      height: HEIGHT,
      model: 'flux-2-pro',
    });

    console.log(`${label} converting PNG → WebP (quality 85)...`);
    const { buffer: webpBuffer, sizeBytes } = await convertToWebP(pngBuffer, {
      quality: 85,
      width: WIDTH,
      height: HEIGHT,
    });

    const key = `home-hero/${spec.bucket}.webp`;
    console.log(`${label} uploading to R2 at ${key}...`);
    const url = await uploadImageToR2(webpBuffer, key, 'image/webp');

    return {
      bucket: spec.bucket,
      ok: true,
      url,
      taskId,
      sizeKb: Math.round(sizeBytes / 1024),
    };
  } catch (err) {
    const message =
      err instanceof FluxApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return { bucket: spec.bucket, ok: false, error: message };
  }
}

function parseArgs(): { bucketFilter: Bucket | null } {
  const arg = process.argv.slice(2).find((a) => a.startsWith('--bucket='));
  if (!arg) return { bucketFilter: null };

  const value = arg.split('=')[1] as Bucket;
  const valid: Bucket[] = ['dawn', 'morning', 'midday', 'golden', 'evening', 'night'];
  if (!valid.includes(value)) {
    console.error(`Invalid --bucket=${value}. Must be one of: ${valid.join(', ')}`);
    process.exit(1);
  }
  return { bucketFilter: value };
}

async function main() {
  const { bucketFilter } = parseArgs();
  const specs = bucketFilter
    ? HERO_IMAGES.filter((s) => s.bucket === bucketFilter)
    : HERO_IMAGES;

  console.log(`Generating ${specs.length} home hero image(s) via Flux 2 Pro...\n`);

  const results: Result[] = [];
  for (const spec of specs) {
    const result = await generateOne(spec);
    results.push(result);
    if (result.ok) {
      console.log(
        `  ✓ ${result.bucket}: ${result.url} (${result.sizeKb} KB, task ${result.taskId})\n`,
      );
    } else {
      console.log(`  ✗ ${result.bucket}: ${result.error}\n`);
    }
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log(`\nDone. Succeeded: ${ok}/${results.length}`);

  if (failed.length > 0) {
    console.log(`\nFailed buckets:`);
    for (const f of failed) {
      console.log(`  - ${f.bucket}: ${f.error}`);
    }
    console.log(`\nRetry with: npx tsx scripts/generate-home-hero-images.ts --bucket=${failed[0].bucket}`);
    process.exit(1);
  }

  const sampleUrl = results[0]?.url;
  if (sampleUrl) {
    const base = sampleUrl.split('/home-hero/')[0];
    console.log(`\nAll images live at: ${base}/home-hero/{bucket}.webp`);
  }
  console.log(`\nNext: update app/components/library/hero-section.tsx bucket→URL map to point at these R2 paths (or let Brief 22b wire them into the new hero component).`);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
