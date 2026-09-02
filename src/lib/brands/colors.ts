export function normalizeBrandColor(value: string): string | null {
  const trimmed = value.trim();
  const hex = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits =
      hex[1].length === 3
        ? hex[1]
            .split("")
            .map((digit) => digit + digit)
            .join("")
        : hex[1];
    return `#${digits.toLowerCase()}`;
  }

  const rgb = trimmed.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (!rgb) return null;
  const channels = rgb.slice(1).map(Number);
  if (channels.some((channel) => channel > 255)) return null;
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminanceChannel(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: string) {
  const normalized = normalizeBrandColor(color);
  if (!normalized) return null;
  const channels = [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
  return (
    0.2126 * relativeLuminanceChannel(channels[0])
    + 0.7152 * relativeLuminanceChannel(channels[1])
    + 0.0722 * relativeLuminanceChannel(channels[2])
  );
}

function colorChannels(color: string) {
  const normalized = normalizeBrandColor(color);
  if (!normalized) return null;
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

export function mixBrandColors(color: string, target: string, amount: number) {
  const colorRgb = colorChannels(color);
  const targetRgb = colorChannels(target);
  if (!colorRgb || !targetRgb) return normalizeBrandColor(color) ?? "#000000";
  const weight = Math.min(1, Math.max(0, amount));
  const channels = colorRgb.map((channel, index) => (
    Math.round(channel + (targetRgb[index] - channel) * weight)
  ));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  if (foregroundLuminance === null || backgroundLuminance === null) return null;

  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export type TextContrastRating = "AAA" | "AA" | "Fail";

export function textContrastRating(foreground: string, background: string): TextContrastRating {
  const ratio = contrastRatio(foreground, background);
  if (ratio !== null && ratio >= 7) return "AAA";
  if (ratio !== null && ratio >= 4.5) return "AA";
  return "Fail";
}

export function darkBrandToneForWhiteText(background: string, minimumContrast = 7) {
  const normalized = normalizeBrandColor(background) ?? "#000000";
  if ((contrastRatio("#ffffff", normalized) ?? 0) >= minimumContrast) return normalized;

  let insufficientAmount = 0;
  let sufficientAmount = 1;
  for (let step = 0; step < 20; step += 1) {
    const amount = (insufficientAmount + sufficientAmount) / 2;
    const candidate = mixBrandColors(normalized, "#000000", amount);
    if ((contrastRatio("#ffffff", candidate) ?? 0) >= minimumContrast) {
      sufficientAmount = amount;
    } else {
      insufficientAmount = amount;
    }
  }
  return mixBrandColors(normalized, "#000000", sufficientAmount);
}

export function readableForegroundColor(background: string) {
  const luminance = relativeLuminance(background);
  if (luminance === null) return "#ffffff";

  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.057;
  return whiteContrast >= darkContrast ? "#ffffff" : "#111827";
}
