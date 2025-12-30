/**
 * Utility functions for formatting compound names and labels
 */

/**
 * Format a compound name to display as "{name} Compound"
 * e.g., "La Mirada" -> "La Mirada Compound"
 */
export function formatCompoundName(name: string | null | undefined): string {
  if (!name) return '';
  return `${name} Compound`;
}

/**
 * Get the generic label for compound/neighbourhood
 * Use "neighbourhood" for generic references, "Compound" for specific names
 */
export function getNeighbourhoodLabel(): string {
  return 'neighbourhood';
}

/**
 * Format compound name with area if available
 * e.g., "La Mirada Compound (New Cairo)"
 */
export function formatCompoundWithArea(
  name: string | null | undefined,
  area: string | null | undefined
): string {
  if (!name) return '';
  const formatted = formatCompoundName(name);
  if (area) {
    return `${formatted} (${area})`;
  }
  return formatted;
}

