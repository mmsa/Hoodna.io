export function accessibleTextValue(value: unknown): { text: string } {
  if (value == null) return { text: "" };
  return { text: String(value) };
}
