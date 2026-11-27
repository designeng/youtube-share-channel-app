import { getLocaleTag, t } from './i18n';

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

export function formatBytes(n: number): string {
  const f = t().format;
  if (n >= 1e9) return f.gb((n / 1e9).toFixed(1).replace('.', f.decimal));
  if (n >= 1e6) return f.mb(Math.round(n / 1e6));
  return f.kb(Math.max(1, Math.round(n / 1e3)));
}

export function formatDate(iso: string, locale = getLocaleTag()): string {
  try {
    return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatCount(n?: number): string {
  if (n == null) return '';
  const f = t().format;
  const short = (v: number) => v.toFixed(1).replace(/\.0$/, '').replace('.', f.decimal);
  if (n >= 1e9) return `${short(n / 1e9)}${f.billion}`;
  if (n >= 1e6) return `${short(n / 1e6)}${f.million}`;
  if (n >= 1e3) return `${short(n / 1e3)}${f.thousand}`;
  return String(n);
}

/** fetch reports a missing connection in English and in different words on each platform. */
export function errorText(message: string): string {
  return /network request failed|failed to fetch/i.test(message) ? t().errors.network : message;
}
