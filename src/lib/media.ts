import { supabase } from "@/integrations/supabase/client";

/**
 * وسائط المشروع تُخزن كمرجع نصي بالشكل: "bucket:path"
 * والدلاء خاصة، لذلك نولّد روابط موقّعة مع كاش بسيط.
 */
const cache = new Map<string, { url: string; expires: number }>();
const inflight = new Map<string, Promise<string | null>>();
const TTL = 60 * 60; // ثانية

export function mediaRef(bucket: string, path: string) {
  return `${bucket}:${path}`;
}

export function parseRef(ref: string): { bucket: string; path: string } | null {
  const i = ref.indexOf(":");
  if (i <= 0) return null;
  return { bucket: ref.slice(0, i), path: ref.slice(i + 1) };
}

export async function getSignedUrl(ref: string | null | undefined): Promise<string | null> {
  if (!ref) return null;
  if (ref.startsWith("http")) return ref;
  const cached = cache.get(ref);
  if (cached && cached.expires > Date.now()) return cached.url;
  const existing = inflight.get(ref);
  if (existing) return existing;

  const parsed = parseRef(ref);
  if (!parsed) return null;

  const promise = supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, TTL)
    .then(({ data }) => {
      const url = data?.signedUrl ?? null;
      if (url) cache.set(ref, { url, expires: Date.now() + (TTL - 60) * 1000 });
      inflight.delete(ref);
      return url;
    })
    .catch(() => {
      inflight.delete(ref);
      return null;
    });

  inflight.set(ref, promise);
  return promise;
}

export async function uploadMedia(
  bucket: string,
  userId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return mediaRef(bucket, path);
}
