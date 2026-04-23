import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
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

function getPublicBaseUrl(): string {
  const url = config.r2.publicUrl;
  return url.startsWith("http") ? url : `https://${url}`;
}

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

  return `${getPublicBaseUrl()}/${key}`;
}

export async function deleteImageFromR2(key: string): Promise<void> {
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
    })
  );
}

export async function listStudyImages(studyId: number): Promise<string[]> {
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

export function makeImageKey(
  studyId: number,
  imageUuid: string,
  extension: string = "webp"
): string {
  return `studies/${studyId}/${imageUuid}.${extension}`;
}

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

  const webpBuffer = await pipeline.webp({ quality: options?.quality ?? 85 }).toBuffer();

  return { buffer: webpBuffer, sizeBytes: webpBuffer.length };
}
