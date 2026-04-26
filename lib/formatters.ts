const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const countFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function formatPhone(e164: string | null | undefined) {
  const digits = (e164 ?? "").replace(/\D/g, "");
  const us = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (us.length !== 10) return e164 ?? "";
  return `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}`;
}

export function maskPhone(e164: string | null | undefined) {
  const digits = (e164 ?? "").replace(/\D/g, "");
  const us = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (us.length !== 10) return e164 ? "***-****" : "";
  return `(***) ***-${us.slice(6)}`;
}

export function formatDate(iso: string | null | undefined) {
  return iso ? dateFormatter.format(new Date(iso)) : "";
}

export function formatTime(iso: string | null | undefined) {
  return iso ? timeFormatter.format(new Date(iso)) : "";
}

export function formatRelativeTime(iso: string | null | undefined) {
  if (!iso) return "";
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs > 86400) return formatDate(iso);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return formatter.format(-seconds, "second");
  if (abs < 3600) return formatter.format(-Math.round(seconds / 60), "minute");
  return formatter.format(-Math.round(seconds / 3600), "hour");
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds < 0) return "0s";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = Math.floor(seconds % 60);
  if (hours) return `${hours}h ${minutes}m`;
  return minutes ? `${minutes}m ${remaining}s` : `${remaining}s`;
}

export function formatCount(n: number | null | undefined) {
  return countFormatter.format(n ?? 0);
}

export function formatCurrency(cents: number | null | undefined) {
  return currencyFormatter.format((cents ?? 0) / 100);
}

export function formatPercent(decimal: number | null | undefined) {
  return percentFormatter.format(decimal ?? 0);
}
