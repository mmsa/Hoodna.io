export function formatFoundResults(count: number, query: string) {
  const noun = count === 1 ? "result" : "results"
  return `Found ${count} ${noun} for "${query}"`
}
