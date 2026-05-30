const UNITS = ["B", "KB", "MB", "GB"] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;
  const digits = unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${UNITS[unitIndex]}`;
}
