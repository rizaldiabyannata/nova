/** Dark or light ink for content drawn on `hex`, by WCAG relative luminance. */
export function inkFor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  // ~0.18 is where contrast against black and white is equal.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.18 ? '#14121c' : '#ffffff';
}
