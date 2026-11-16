import { backendFetch } from './backend-fetch';

const cache = new Map<string, { blob: Blob; expires: number }>();
const MAX_BYTES = 16 * 1024 * 1024;

export async function speechBlob(text: string, signal: AbortSignal): Promise<Blob> {
  const existing = cache.get(text);
  if (existing && existing.expires > Date.now()) { cache.delete(text); cache.set(text, existing); return existing.blob; }
  const response = await backendFetch('/api/tts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal,
  });
  if (!response.ok) throw new Error(await response.text());
  const blob = await response.blob();
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  if (blob.size <= MAX_BYTES) {
    cache.delete(text);
    cache.set(text, { blob, expires: Date.now() + 10 * 60 * 1000 });
    let bytes = [...cache.values()].reduce((sum, item) => sum + item.blob.size, 0);
    while (cache.size > 20 || bytes > MAX_BYTES) {
      const key = cache.keys().next().value!; bytes -= cache.get(key)!.blob.size; cache.delete(key);
    }
  }
  return blob;
}
