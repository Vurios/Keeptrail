/**
 * Date helpers for deadlines.
 *
 * Reminders previously rendered a bare ISO date in the brand colour whether it
 * had passed last month or fell next year, on a screen whose entire subject is
 * urgency. These turn a date into the thing the user actually needs to know.
 */

export type DueUrgency = "overdue" | "today" | "soon" | "later" | "unknown";

const MS_PER_DAY = 86400000;

function toUtcMidnight(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(timestamp) ? null : timestamp;
}

/** Whole days from today to `iso`. Negative means the date has passed. */
export function daysUntil(iso: string, now: Date = new Date()): number | null {
  const target = toUtcMidnight(iso);
  if (target === null) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / MS_PER_DAY);
}

export function dueUrgency(iso: string, now: Date = new Date()): DueUrgency {
  const days = daysUntil(iso, now);
  if (days === null) return "unknown";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "soon";
  return "later";
}

/** Plain-language deadline, e.g. "Overdue by 5 days" or "Due in 3 days". */
export function relativeDueLabel(iso: string, now: Date = new Date()): string {
  const days = daysUntil(iso, now);
  if (days === null) return "No due date";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "Overdue by 1 day";
  if (days < 0) return `Overdue by ${Math.abs(days)} days`;
  if (days <= 30) return `Due in ${days} days`;
  return `Due ${formatDate(iso)}`;
}

/** A date a person reads, e.g. "4 Sep 2026". Falls back to the raw string. */
export function formatDate(iso: string | null): string {
  if (!iso) return "No date";
  const timestamp = toUtcMidnight(iso);
  if (timestamp === null) return iso;
  const date = new Date(timestamp);
  const month = date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
}

/** Today as `YYYY-MM-DD`, the storage format for every date field. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Validates a typed date. Returns an error message, or null when acceptable.
 * An empty value is allowed: an unknown date stays unknown rather than being
 * guessed.
 */
export function validateDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return "Use the format YYYY-MM-DD, for example 2026-09-04.";
  }
  const timestamp = toUtcMidnight(trimmed);
  if (timestamp === null) return "That is not a real date.";
  const date = new Date(timestamp);
  if (date.toISOString().slice(0, 10) !== trimmed) {
    return "That is not a real date.";
  }
  return null;
}
