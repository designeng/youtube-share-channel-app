/** ISO 8601 duration (PT1H2M3S) -> seconds */
export function parseIsoDuration(iso?: string): number | undefined {
  if (!iso) return undefined;
  const m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return undefined;
  const [, d, h, min, s] = m.map((x) => (x ? Number(x) : 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

export function formatTime(totalSec: number): string {
  if (!isFinite(totalSec)) return '--:--';
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function formatDate(iso: string, locale = 'ru-RU'): string {
  try {
    return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatCount(n?: number): string {
  if (n == null) return '';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')} млрд`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')} млн`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')} тыс.`;
  return String(n);
}
