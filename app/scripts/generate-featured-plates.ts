/**
 * Generate the atmospheric "featured plate" images for the home FeaturedStudy
 * component (Stage 0b of the Library Redesign).
 *
 * These images are NOT study-specific — they are generic editorial atmospheres
 * (warm landscapes, manuscript abstracts, olive groves, ancient stones, etc.)
 * that rotate by day-of-year so the homepage feels alive over time. The
 * FeaturedStudy component reads them via `app/lib/home/featured-plates.ts`.
 *
 * Each prompt is hand-tuned for warm, painterly, editorial atmosphere — NOT
 * generic stock-photo "Bible study" imagery (no candles next to Bibles on
 * wooden tables, no praying hands, no crosses). Editorial luxury, not
 * faith-stock. Per the project_avoid_cliche_imagery memory.
 *
 * Workflow:
 *   1. Run this script:    cd app && npx tsx scripts/generate-featured-plates.ts
 *   2. Confirm cost prompt (or pass --yes to skip).
 *   3. Copy the printed TS snippet into app/lib/home/featured-plates.ts.
 *   4. Commit the populated manifest.
 *
 * Run: cd app && npx tsx scripts/generate-featured-plates.ts [--yes] [--force]
 *   --yes    Skip stdin confirmation (for CI/scripted runs).
 *   --force  Overwrite existing R2 objects with the same key (default: skip).
 *
 * Requires env: FLUX_API_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL.
 *
 * Cost: ~$0.05 per image × 6 = ~$0.30 per full run (flux-2-pro).
 */

import 'dotenv/config';
import * as readline from 'node:readline';
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { generateImage, FluxApiError, estimateCost } from '../lib/images/flux';
import { uploadImageToR2, convertToWebP } from '../lib/images/r2';
import { config } from '../lib/config';

interface PlateSpec {
  /** 1-indexed sequence number, used in the R2 key prefix. */
  idx: number;
  /** kebab-case slug for the R2 key suffix. */
  slug: string;
  /** Human-readable alt text for the manifest. */
  alt: string;
  /** Full Flux prompt. */
  prompt: string;
}

const PLATES: PlateSpec[] = [
  {
    idx: 1,
    slug: 'olive-grove-dusk',
    alt: 'An olive grove at dusk, warm Mediterranean light filtering through silvery leaves',
    prompt:
      'Painterly editorial photography of an olive grove at golden hour, warm Mediterranean light filtering through silvery leaves, soft focus on weathered branches, gentle bokeh, atmospheric and contemplative, no people, no text, no lettering, cinematic depth of field, 16:9 landscape composition',
  },
  {
    idx: 2,
    slug: 'open-manuscript-stone',
    alt: 'A weathered open manuscript on a stone surface, soft directional light',
    prompt:
      'Editorial still life of a weathered open manuscript on a stone surface, soft directional light, parchment texture, faint ink illuminations partially visible but not legible, shallow depth of field, painterly fine art photography, warm earth tones, no people, no readable text, no modern objects, 16:9 landscape composition',
  },
  {
    idx: 3,
    slug: 'library-light-beams',
    alt: 'Dappled morning light through tall windows of an old library, dust motes in the beams',
    prompt:
      'Painterly cinematic atmosphere of dappled morning light streaming through tall windows of an ancient stone library, warm golden tones, dust motes suspended in the beams, soft volumetric light, weathered wooden shelves in shadow, no people, no text, no modern objects, 16:9 landscape composition',
  },
  {
    idx: 4,
    slug: 'ancient-stone-steps',
    alt: 'Ancient stone steps leading into shadow, weathered and warm-toned',
    prompt:
      'Painterly editorial photography of ancient weathered stone steps leading into soft shadow, warm sandstone tones, soft side light, contemplative quiet mood, fine grain texture on the stone, no people, no text, no modern elements, 16:9 landscape composition',
  },
  {
    idx: 5,
    slug: 'misted-hills-first-light',
    alt: 'Rolling hills at first light, soft mist in the valley, distant olive trees',
    prompt:
      'Editorial landscape painting style, rolling hills at first light, soft mist drifting through the valley, warm earth tones, distant olive trees on a far ridge, painterly atmospheric photography, no people, no structures, no text, 16:9 landscape composition',
  },
  {
    idx: 6,
    slug: 'candlelit-alcove',
    alt: 'A candlelit stone alcove with weathered wood, warm flickering light',
    prompt:
      'Editorial fine art photography of a candlelit stone alcove with weathered wood and rough plaster, warm flickering light, painterly chiaroscuro, intimate quiet scene, deep shadows and amber highlights, no people, no religious symbols, no text, no modern objects, 16:9 landscape composition',
  },
];

const WIDTH = 1920;
const HEIGHT = 1080;
const PREFIX = 'featured-plates/';
const MODEL = 'flux-2-pro' as const;

interface Result {
  spec: PlateSpec;
  ok: boolean;
  skipped?: boolean;
  url?: string;
  taskId?: string;
  sizeKb?: number;
  error?: string;
}

interface CliFlags {
  yes: boolean;
  force: boolean;
}

function parseArgs(): CliFlags {
  const args = process.argv.slice(2);
  return {
    yes: args.includes('--yes'),
    force: args.includes('--force'),
  };
}

function plateKey(spec: PlateSpec): string {
  const padded = String(spec.idx).padStart(2, '0');
  return `${PREFIX}${padded}-${spec.slug}.webp`;
}

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
  });
}

async function listExistingKeys(): Promise<Set<string>> {
  const client = getR2Client();
  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: config.r2.bucketName,
      Prefix: PREFIX,
    }),
  );
  return new Set((result.Contents ?? []).map((o) => o.Key!).filter(Boolean));
}

function publicUrlForKey(key: string): string {
  const base = config.r2.publicUrl.startsWith('http')
    ? config.r2.publicUrl
    : `https://${config.r2.publicUrl}`;
  return `${base.replace(/\/$/, '')}/${key}`;
}

async function confirm(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

async function generateOne(spec: PlateSpec): Promise<Result> {
  const label = `[${String(spec.idx).padStart(2, '0')}-${spec.slug.padEnd(24)}]`;
  try {
    console.log(`${label} generating (Flux ${MODEL}, ${WIDTH}x${HEIGHT})...`);
    const { buffer: pngBuffer, taskId } = await generateImage({
      prompt: spec.prompt,
      width: WIDTH,
      height: HEIGHT,
      model: MODEL,
    });

    console.log(`${label} converting PNG → WebP (quality 85)...`);
    const { buffer: webpBuffer, sizeBytes } = await convertToWebP(pngBuffer, {
      quality: 85,
      width: WIDTH,
      height: HEIGHT,
    });

    const key = plateKey(spec);
    console.log(`${label} uploading to R2 at ${key} (${Math.round(sizeBytes / 1024)} KB)...`);
    const url = await uploadImageToR2(webpBuffer, key, 'image/webp');

    return {
      spec,
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
    return { spec, ok: false, error: message };
  }
}

function printManifestSnippet(results: Result[]): void {
  const successes = results.filter((r) => r.ok && r.url).sort((a, b) => a.spec.idx - b.spec.idx);
  if (successes.length === 0) {
    console.log('\nNo successful generations — nothing to paste.\n');
    return;
  }

  console.log('\n' + '─'.repeat(72));
  console.log('Paste the following into app/lib/home/featured-plates.ts:');
  console.log('─'.repeat(72) + '\n');
  console.log('export const FEATURED_PLATES: readonly FeaturedPlate[] = [');
  for (const r of successes) {
    const altEscaped = r.spec.alt.replace(/'/g, "\\'");
    console.log(`  { idx: ${r.spec.idx}, url: '${r.url}', alt: '${altEscaped}' },`);
  }
  console.log('];\n');
}

async function main() {
  const flags = parseArgs();

  if (!config.r2.accountId || !config.ai.fluxApiKey) {
    console.error('Missing required env. Source .env first:');
    console.error('  set -a && source .env && set +a && npx tsx scripts/generate-featured-plates.ts');
    process.exit(1);
  }

  console.log(`\nFeatured-plate generation (${PLATES.length} images, ${MODEL}, ${WIDTH}x${HEIGHT})`);
  console.log(`Target: r2://${config.r2.bucketName}/${PREFIX}\n`);

  // Idempotency: list existing keys and decide which specs to skip.
  console.log('Checking existing R2 keys...');
  let existing: Set<string>;
  try {
    existing = await listExistingKeys();
  } catch (err) {
    console.error('Failed to list R2 objects:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const toGenerate: PlateSpec[] = [];
  const skipped: PlateSpec[] = [];
  for (const spec of PLATES) {
    const key = plateKey(spec);
    if (existing.has(key) && !flags.force) {
      skipped.push(spec);
    } else {
      toGenerate.push(spec);
    }
  }

  if (skipped.length > 0) {
    console.log(`\nSkipping ${skipped.length} already-uploaded plate(s) (pass --force to overwrite):`);
    for (const s of skipped) console.log(`  - ${plateKey(s)}`);
  }

  if (toGenerate.length === 0) {
    console.log('\nNothing to generate. All plates already exist in R2.\n');
    // Still print snippet for the existing keys so the user can populate the manifest.
    const synthetic: Result[] = PLATES.map((spec) => ({
      spec,
      ok: true,
      url: publicUrlForKey(plateKey(spec)),
    }));
    printManifestSnippet(synthetic);
    return;
  }

  const cost = estimateCost(toGenerate.length, MODEL);
  console.log(
    `\nWill generate ${toGenerate.length} image(s) — estimated cost ${cost.formatted} ` +
      `($${cost.perImage.toFixed(2)}/image × ${toGenerate.length}).`,
  );

  if (!flags.yes) {
    const ok = await confirm('Proceed? [y/N] ');
    if (!ok) {
      console.log('Aborted.');
      process.exit(0);
    }
  } else {
    console.log('--yes flag set, skipping confirmation.');
  }

  console.log('');
  const results: Result[] = [];

  // Add synthetic "skipped" results so the printed manifest snippet covers
  // the full set, not just freshly-generated entries.
  for (const spec of skipped) {
    results.push({
      spec,
      ok: true,
      skipped: true,
      url: publicUrlForKey(plateKey(spec)),
    });
  }

  for (const spec of toGenerate) {
    const result = await generateOne(spec);
    results.push(result);
    if (result.ok) {
      console.log(
        `  ✓ ${plateKey(result.spec)}: ${result.url} (${result.sizeKb} KB, task ${result.taskId})\n`,
      );
    } else {
      console.log(`  ✗ ${plateKey(result.spec)}: ${result.error}\n`);
    }
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const generated = results.filter((r) => r.ok && !r.skipped).length;

  console.log(`\nDone. Succeeded: ${ok}/${results.length} (newly generated: ${generated}, skipped: ${skipped.length})`);

  if (failed.length > 0) {
    console.log(`\nFailed plates:`);
    for (const f of failed) {
      console.log(`  - ${plateKey(f.spec)}: ${f.error}`);
    }
    printManifestSnippet(results);
    process.exit(1);
  }

  printManifestSnippet(results);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
