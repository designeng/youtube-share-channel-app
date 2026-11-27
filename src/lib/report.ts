/**
 * Sends a complaint about an AI-written text to the developer (Google Play asks AI apps to offer this
 * inside the app). EXPO_PUBLIC_REPORT_URL is any endpoint that accepts a JSON POST. Without it the report
 * goes to the system share sheet, and the user picks where to send it.
 */
import { Share } from 'react-native';

export const REPORT_REASONS = ['offensive', 'dangerous', 'inaccurate', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Never put API keys here. */
export type Report = {
  reason: ReportReason;
  comment: string;
  videoId: string;
  /** chapter index or 'all' */
  target: string;
  provider: string;
  model: string;
  language: string;
  text: string;
};

const REPORT_URL = process.env.EXPO_PUBLIC_REPORT_URL;
const TIMEOUT_MS = 20_000;

export const reportsGoToDeveloper = !!REPORT_URL;

export async function sendReport(report: Report): Promise<'sent' | 'shared' | 'dismissed'> {
  if (!REPORT_URL) {
    const { text, ...about } = report;
    const result = await Share.share({ message: `${JSON.stringify(about, null, 2)}\n\n${text}` });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  }
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(REPORT_URL, {
      method: 'POST',
      signal: abort.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(report),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'sent';
  } finally {
    clearTimeout(timer);
  }
}
