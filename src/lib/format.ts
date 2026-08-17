export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "الآن";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${days} يوم`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `منذ ${weeks} أسبوع`;
  const months = Math.floor(days / 30);
  if (months < 12) return `منذ ${months} شهر`;
  return `منذ ${Math.floor(days / 365)} سنة`;
}

export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")} ألف`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} مليون`;
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}
