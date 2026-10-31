export function collapseWhitespace(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fold(value: string): string {
  return collapseWhitespace(value)
    .replace(/[\u2019']/g, "'")
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}
