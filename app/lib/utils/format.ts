// Date formatting and text utilities

/**
 * Render a date as "May 1, 2026". Returns the raw string on invalid input
 * (rather than "Invalid Date") so callers can pass through ISO strings from
 * the DB without an extra guard. Single source of truth — used by reader,
 * PDF export, and any other display path.
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return typeof date === "string" ? date : "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
