import { list, put } from '@vercel/blob';
import type { UploadPayload } from '@/lib/types';

const PATHNAME = 'vencimientos/latest.json';

export async function savePayload(payload: UploadPayload) {
  return put(PATHNAME, JSON.stringify(payload, null, 2), {
    access: 'public',
    allowOverwrite: true,
    contentType: 'application/json; charset=utf-8',
  });
}

export async function loadPayload(): Promise<UploadPayload | null> {
  const { blobs } = await list({ prefix: PATHNAME, limit: 10 });
  const latest = blobs.find((blob) => blob.pathname === PATHNAME) ?? blobs[0];
  if (!latest?.url) return null;

  const response = await fetch(latest.url, { cache: 'no-store' });
  if (!response.ok) return null;
  return (await response.json()) as UploadPayload;
}
