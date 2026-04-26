/**
 * R2 client for the *data* bucket (Bible DBs, large infrastructure assets
 * that change rarely). Separate credentials and bucket from the image
 * R2 helper at lib/images/r2.ts so a leak of one set of creds doesn't
 * expose the other.
 *
 * Used by:
 *   - scripts/upload-bible-dbs-to-r2.ts (one-shot: push from local)
 *   - instrumentation.ts startup hook (download-on-boot if files missing)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { config } from '@/lib/config';

let dataClient: S3Client | null = null;

function getDataClient(): S3Client {
  if (!dataClient) {
    if (!config.r2Data.accountId) {
      throw new Error('R2_DATA_ACCOUNT_ID is not set');
    }
    if (!config.r2Data.accessKeyId || !config.r2Data.secretAccessKey) {
      throw new Error('R2_DATA_ACCESS_KEY_ID / R2_DATA_SECRET_ACCESS_KEY missing');
    }
    dataClient = new S3Client({
      region: 'auto',
      endpoint: `https://${config.r2Data.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2Data.accessKeyId,
        secretAccessKey: config.r2Data.secretAccessKey,
      },
    });
  }
  return dataClient;
}

/**
 * Upload a buffer/stream to R2 under the given key.
 * Used by the one-shot script to push local Bible DBs.
 */
export async function putDataObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string = 'application/octet-stream',
): Promise<void> {
  const client = getDataClient();
  await client.send(
    new PutObjectCommand({
      Bucket: config.r2Data.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Bible DBs are immutable for the lifetime of an edition; let CDN cache
      // edge nodes hold them indefinitely. If a DB is replaced, change the
      // key (e.g. include a version segment) rather than mutating in place.
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}

/**
 * Download an object from R2 to a Node Buffer.
 * Used by the startup-download hook in instrumentation.ts.
 */
export async function getDataObject(key: string): Promise<Buffer> {
  const client = getDataClient();
  const out = await client.send(
    new GetObjectCommand({
      Bucket: config.r2Data.bucketName,
      Key: key,
    }),
  );
  if (!out.Body) throw new Error(`R2 object ${key} returned no body`);
  // The SDK returns a streaming Body; collect into a Buffer.
  const chunks: Buffer[] = [];
  for await (const chunk of out.Body as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Check whether an object exists at the given key. Lighter than GET.
 */
export async function dataObjectExists(key: string): Promise<boolean> {
  const client = getDataClient();
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: config.r2Data.bucketName,
        Key: key,
      }),
    );
    return true;
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === 'NotFound' || name === 'NoSuchKey') return false;
    throw err;
  }
}

/**
 * List object keys under a prefix (one page, up to 1000). Used by the
 * upload script to verify what's already in the bucket.
 */
export async function listDataObjects(prefix: string): Promise<string[]> {
  const client = getDataClient();
  const out = await client.send(
    new ListObjectsV2Command({
      Bucket: config.r2Data.bucketName,
      Prefix: prefix,
    }),
  );
  return (out.Contents ?? []).map((o) => o.Key ?? '').filter(Boolean);
}
