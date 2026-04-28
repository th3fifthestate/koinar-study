// app/lib/export/r2-export-storage.ts
//
// Cloudflare R2 storage for generated PDF exports. Distinct from
// lib/images/r2.ts in two ways:
//
//   1. Exports are private — never written with a public-cache header. We
//      hand back a presigned URL that's valid for 24 hours; after that the
//      R2 lifecycle rule (configured separately on the bucket — see the
//      runbook) deletes the object so the URL stops resolving even if it
//      leaked.
//   2. Exports use a per-user prefix (`exports/<userId>/...`) so the
//      lifecycle rule can target only the export tree without touching
//      images or seasonal art.

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "@/lib/config";

const PRESIGN_TTL_SECONDS = 24 * 60 * 60; // 24h — matches the lifecycle rule.

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
  }
  return client;
}

export interface ExportUploadResult {
  key: string;
  /** 24h-presigned URL the client can GET to download the export. */
  url: string;
  expiresAt: string;
}

export interface ExportUploadOptions {
  userId: number;
  studyId: number;
  translation: string;
  format: "pdf";
  buffer: Buffer;
  filename: string;
}

/**
 * Upload an export object to R2 and return a 24h-presigned download URL.
 * The bucket lifecycle rule on the `exports/` prefix auto-deletes objects
 * after 24h — even if the URL leaked, it would fail to resolve.
 */
export async function putExport(
  opts: ExportUploadOptions,
): Promise<ExportUploadResult> {
  const key = makeExportKey(opts);
  const c = getClient();

  await c.send(
    new PutObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
      Body: opts.buffer,
      ContentType: contentTypeFor(opts.format),
      // Force download with a sensible filename in the user's downloads UI.
      ContentDisposition: `attachment; filename="${opts.filename}"`,
      // Belt-and-braces: even if the lifecycle rule were misconfigured, this
      // header keeps the object from being treated as long-lived by any CDN.
      CacheControl: "private, no-store",
      Metadata: {
        "koinar-user-id": String(opts.userId),
        "koinar-study-id": String(opts.studyId),
        "koinar-translation": opts.translation,
        "koinar-format": opts.format,
      },
    }),
  );

  const url = await getSignedUrl(
    c,
    new GetObjectCommand({ Bucket: config.r2.bucketName, Key: key }),
    { expiresIn: PRESIGN_TTL_SECONDS },
  );

  const expiresAt = new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000).toISOString();
  return { key, url, expiresAt };
}

export function makeExportKey(opts: {
  userId: number;
  studyId: number;
  translation: string;
  format: "pdf";
}): string {
  const ts = Date.now();
  return `exports/${opts.userId}/${opts.studyId}-${opts.translation}-${ts}.${opts.format}`;
}

function contentTypeFor(format: "pdf"): string {
  return format === "pdf" ? "application/pdf" : "application/octet-stream";
}
