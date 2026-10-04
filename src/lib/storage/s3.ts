import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Object storage — S3-compatible, backed by the MinIO container in development
 * and by any S3 service in production. Replaces Supabase Storage.
 *
 * Two buckets:
 *   documents — private. Reads go through short-lived presigned URLs.
 *   quotes    — public-read. A quote PDF's URL is persisted on the quote row and
 *               sent to clients over WhatsApp, so it has to stay valid
 *               indefinitely; a presigned URL would expire underneath them.
 */
export const DOCUMENTS_BUCKET = process.env.S3_BUCKET ?? 'documents';
export const QUOTES_BUCKET = process.env.S3_QUOTES_BUCKET ?? 'quotes';

let cachedInternal: S3Client | null = null;
let cachedPublic: S3Client | null = null;

function build(endpoint: string): S3Client {
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Object storage is not configured (S3_ACCESS_KEY / S3_SECRET_KEY).');
  }

  return new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? 'us-east-1',
    credentials: { accessKeyId, secretAccessKey },
    // MinIO serves buckets as a path segment rather than a subdomain.
    forcePathStyle: true,
  });
}

/** Server-to-storage traffic: uploads and deletes, over the internal network. */
function client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  if (!endpoint) throw new Error('Object storage is not configured (S3_ENDPOINT).');
  cachedInternal ??= build(endpoint);
  return cachedInternal;
}

/**
 * Client used only for presigning. A presigned URL's signature covers the host,
 * so it must be generated against the address the *browser* will use. Inside
 * Docker the app talks to `minio:9000`, which no browser can resolve — hence the
 * separate S3_PUBLIC_URL endpoint.
 */
function presignClient(): S3Client {
  const endpoint = process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT;
  if (!endpoint) throw new Error('Object storage is not configured (S3_ENDPOINT).');
  cachedPublic ??= build(endpoint);
  return cachedPublic;
}

/**
 * What callers are allowed to store.
 *
 * The content type was previously passed straight through to S3 with no
 * allowlist and no size ceiling, so any authenticated caller could park
 * arbitrary files of arbitrary size in the bucket — and a stored text/html
 * served back from the storage origin is a scripting vector.
 */
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
  'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

/** 25 MB — comfortably above a phone photo, well below a memory problem. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export class UploadRejected extends Error {}

export async function putObject(opts: {
  bucket?: string;
  key: string;
  body: Buffer;
  contentType?: string;
}): Promise<void> {
  if (opts.body.byteLength > MAX_UPLOAD_BYTES) {
    throw new UploadRejected(
      `File is ${(opts.body.byteLength / 1024 / 1024).toFixed(1)} MB. The limit is ` +
        `${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    );
  }

  // Normalise `image/jpeg; charset=…` down to the media type before checking.
  const contentType = (opts.contentType ?? 'application/octet-stream')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new UploadRejected(`Files of type "${contentType}" cannot be uploaded.`);
  }

  await client().send(
    new PutObjectCommand({
      Bucket: opts.bucket ?? DOCUMENTS_BUCKET,
      Key: opts.key,
      Body: opts.body,
      // Store the normalised type, never the caller's raw header.
      ContentType: contentType,
    }),
  );
}

/**
 * Time-limited presigned URL.
 * `inline: true`  → browser renders PDF in-tab (native preview + toolbar).
 * `filename`      → forces download with the given save-as name.
 * Neither          → no Content-Disposition override; browser decides.
 */
export async function getDownloadUrl(opts: {
  bucket?: string;
  key: string;
  expiresIn?: number;
  filename?: string;
  inline?: boolean;
}): Promise<string> {
  const disposition = opts.inline
    ? 'inline'
    : opts.filename
    ? `attachment; filename="${opts.filename.replace(/"/g, '')}"`
    : undefined;

  const command = new GetObjectCommand({
    Bucket: opts.bucket ?? DOCUMENTS_BUCKET,
    Key: opts.key,
    ResponseContentDisposition: disposition,
  });
  return getSignedUrl(presignClient(), command, { expiresIn: opts.expiresIn ?? 300 });
}

/**
 * Stable, non-expiring URL. Only valid for a bucket with public read access.
 *
 * Deliberately throws rather than falling back to S3_ENDPOINT: the result is
 * persisted (quotes.pdfUrl) and sent to clients over WhatsApp, so a misconfigured
 * deployment would silently mail out permanently-broken internal URLs like
 * http://minio:9000/... Failing loudly here is far cheaper than that.
 */
export function getPublicUrl(bucket: string, key: string): string {
  const base = process.env.S3_PUBLIC_URL?.replace(/\/+$/, '');
  if (!base) {
    throw new Error(
      'S3_PUBLIC_URL is not set — refusing to build a public URL that clients could not reach.',
    );
  }
  return `${base}/${bucket}/${key}`;
}

export interface S3ObjectMeta {
  key: string;
  size: number;
  lastModified: Date;
}

/** List all objects under a given prefix. */
export async function listObjects(prefix: string, bucket?: string): Promise<S3ObjectMeta[]> {
  const results: S3ObjectMeta[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await client().send(new ListObjectsV2Command({
      Bucket: bucket ?? DOCUMENTS_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const obj of res.Contents ?? []) {
      if (obj.Key && obj.Size != null && obj.LastModified) {
        results.push({ key: obj.Key, size: obj.Size, lastModified: obj.LastModified });
      }
    }
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);
  return results;
}

/** Delete a single object. */
export async function deleteObject(key: string, bucket?: string): Promise<void> {
  await client().send(new DeleteObjectCommand({
    Bucket: bucket ?? DOCUMENTS_BUCKET,
    Key: key,
  }));
}

/** Best-effort bulk delete — callers treat storage failures as non-fatal. */
export async function deleteObjects(keys: string[], bucket?: string): Promise<void> {
  if (!keys.length) return;

  // DeleteObjects caps out at 1000 keys per call.
  for (let i = 0; i < keys.length; i += 1000) {
    await client().send(
      new DeleteObjectsCommand({
        Bucket: bucket ?? DOCUMENTS_BUCKET,
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
      }),
    );
  }
}
