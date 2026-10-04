'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Camera, Loader2, X, AlertTriangle } from 'lucide-react';

/**
 * Photo picker that uploads straight to object storage and hands back the
 * stored URLs. Large phone photos are downscaled in the browser first
 * (long edge ≤ 2000px, JPEG q0.85) so uploads stay fast on site data.
 *
 * The parent owns the list of uploaded URLs (`value` / `onChange`) and should
 * block submit while `onBusyChange(true)`.
 */

export type PhotoUploadScope = 'site-visit' | 'snag' | 'employee';

interface PhotoUploaderProps {
  /** What the photos belong to — decides the server-side role + tenant check. */
  scope: PhotoUploadScope;
  /** Site visit id, project id (for snags) or employee id. */
  entityId: string;
  value: string[];
  onChange: (urls: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
  maxFiles?: number;
  disabled?: boolean;
}

interface PendingPhoto {
  id: string;
  previewUrl: string;
  progress: number; // 0–100
  error: string | null;
}

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 2;
// Local ids for pending tiles. Not crypto.randomUUID(): that only exists on
// HTTPS/localhost, and phones testing over http://<lan-ip> would break.
let nextPendingId = 0;
const PASSTHROUGH_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Decode → downscale → JPEG. Falls back to the original when the browser can't decode it. */
async function preparePhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    // 'from-image' applies EXIF orientation so portrait phone shots don't come out sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (PASSTHROUGH_TYPES.has(file.type)) return file;
    throw new Error('Unsupported photo format — choose a JPG or PNG');
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    // Already small and web-friendly — skip the re-encode.
    if (scale === 1 && file.type === 'image/jpeg' && file.size <= 1.5 * 1024 * 1024) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process photo');
    // White underlay so transparent PNGs don't turn black as JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not process photo'))),
        'image/jpeg',
        JPEG_QUALITY,
      );
    });
  } finally {
    bitmap.close();
  }
}

/** XHR rather than fetch so we get upload progress. Resolves to the stored URL. */
function uploadPhoto(
  blob: Blob,
  scope: PhotoUploadScope,
  entityId: string,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const form = new FormData();
    form.append('file', blob, `photo.${ext}`);
    form.append('scope', scope);
    form.append('entityId', entityId);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/v1/uploads/photos');
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const body = xhr.response as { data?: { url?: string }; error?: string } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.data?.url) {
        resolve(body.data.url);
      } else {
        reject(new Error(typeof body?.error === 'string' ? body.error : 'Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error — try again'));
    xhr.send(form);
  });
}

export function PhotoUploader({
  scope, entityId, value, onChange, onBusyChange, maxFiles = 12, disabled = false,
}: PhotoUploaderProps) {
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Latest committed URLs — concurrent uploads finish out of order and must not clobber each other.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  // Decodes run one at a time: several 12–48 MP decodes at once can crash low-end phones.
  const decodeChain = useRef<Promise<unknown>>(Promise.resolve());
  const previews = useRef(new Set<string>());
  const removed = useRef(new Set<string>());

  const busy = pending.some((p) => p.error === null);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  const onBusyRef = useRef(onBusyChange);
  useLayoutEffect(() => { onBusyRef.current = onBusyChange; });

  useEffect(() => {
    const urls = previews.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      // Uploads still in flight keep running and report their URL via onChange,
      // but a closed picker must not leave the parent's submit locked.
      onBusyRef.current?.(false);
    };
  }, []);

  function patch(id: string, changes: Partial<PendingPhoto>) {
    setPending((list) => list.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  }

  function dropPending(id: string) {
    setPending((list) => {
      const item = list.find((p) => p.id === id);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
        previews.current.delete(item.previewUrl);
      }
      return list.filter((p) => p.id !== id);
    });
  }

  async function processOne(item: PendingPhoto, file: File) {
    try {
      const run = decodeChain.current.then(() => preparePhoto(file));
      decodeChain.current = run.catch(() => undefined);
      const blob = await run;
      if (removed.current.has(item.id)) return;
      if (blob.size > MAX_UPLOAD_BYTES) throw new Error('Photo is too large (max 10 MB)');

      const url = await uploadPhoto(blob, scope, entityId, (pct) => patch(item.id, { progress: pct }));
      if (removed.current.has(item.id)) return;

      const next = [...valueRef.current, url];
      valueRef.current = next;
      onChangeRef.current(next);
      dropPending(item.id);
    } catch (e) {
      if (removed.current.has(item.id)) return;
      patch(item.id, { error: e instanceof Error ? e.message : 'Upload failed' });
    }
  }

  function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const room = Math.max(0, maxFiles - value.length - pending.length);
    const files = Array.from(list).slice(0, room);

    const items = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previews.current.add(previewUrl);
      return { file, item: { id: `p${++nextPendingId}`, previewUrl, progress: 0, error: null } as PendingPhoto };
    });
    setPending((prev) => [...prev, ...items.map((x) => x.item)]);

    // Small worker pool: a couple of uploads in flight at once.
    const queue = [...items];
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        await processOne(next.item, next.file);
      }
    };
    for (let i = 0; i < Math.min(UPLOAD_CONCURRENCY, queue.length); i++) void worker();
  }

  function removePending(id: string) {
    removed.current.add(id);
    dropPending(id);
  }

  function removeUploaded(url: string) {
    const next = valueRef.current.filter((u) => u !== url);
    valueRef.current = next;
    onChange(next);
  }

  const canAdd = !disabled && value.length + pending.length < maxFiles;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((url) => (
          <div key={url} className="relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
            <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Uploaded photo" className="h-full w-full object-cover" />
            </a>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeUploaded(url)}
                aria-label="Remove photo"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}

        {pending.map((p) => (
          <div key={p.id} className="relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.previewUrl} alt="Photo being uploaded" className="h-full w-full object-cover opacity-60" />
            {p.error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-red-600/75 px-1 text-center text-[10px] font-medium leading-tight text-white" title={p.error}>
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="line-clamp-2">{p.error}</span>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/30 text-[10px] font-semibold text-white">
                <Loader2 className="h-4 w-4 animate-spin" />
                {p.progress > 0 && <span>{p.progress}%</span>}
              </div>
            )}
            <button
              type="button"
              onClick={() => removePending(p.id)}
              aria-label="Remove photo"
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-base)] hover:text-[var(--accent-base)]"
          >
            <Camera className="h-5 w-5" />
            {maxFiles === 1 ? 'Add photo' : 'Add photos'}
          </button>
        )}
      </div>

      {/* No `capture` attribute: phones then offer both camera and gallery. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={maxFiles > 1}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {maxFiles > 1 && (
        <p className="text-[11px] text-[var(--text-tertiary)]">
          {value.length}/{maxFiles} photos · take a photo or pick from your gallery
        </p>
      )}
    </div>
  );
}
