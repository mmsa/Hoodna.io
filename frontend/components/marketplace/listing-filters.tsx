import { Search, SlidersHorizontal, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LISTING_CATEGORIES,
  LISTING_INTENTS,
  LISTING_SORT_OPTIONS,
} from "./listing-meta"

export interface ListingFilterValues {
  search: string
  category: string
  intent: string
  sort: string
  minPrice: string
  maxPrice: string
}

export function ListingFilters({
  value,
  onChange,
  onClear,
  includeServices = false,
}: {
  value: ListingFilterValues
  onChange: (next: ListingFilterValues) => void
  onClear: () => void
  includeServices?: boolean
}) {
  const set = (key: keyof ListingFilterValues, next: string) =>
    onChange({ ...value, [key]: next })
  const categories = includeServices
    ? LISTING_CATEGORIES
    : LISTING_CATEGORIES.filter((category) => category.value !== "SERVICE")

  return (
    <section aria-label="Marketplace filters" className="rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_150px_180px]">
        <label className="relative">
          <span className="sr-only">Search listings</span>
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={value.search}
            onChange={(event) => set("search", event.target.value)}
            placeholder="Search listings"
            className="pl-9"
          />
        </label>
        <Select value={value.category || "all"} onValueChange={(next) => set("category", next === "all" ? "" : next)}>
          <SelectTrigger aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.value || "all"} value={category.value || "all"}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={value.intent || "all"} onValueChange={(next) => set("intent", next === "all" ? "" : next)}>
          <SelectTrigger aria-label="Listing type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LISTING_INTENTS.map((intent) => (
              <SelectItem key={intent.value || "all"} value={intent.value || "all"}>
                {intent.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={value.sort} onValueChange={(next) => set("sort", next)}>
          <SelectTrigger aria-label="Sort listings">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LISTING_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-end">
        <div className="grid flex-1 grid-cols-2 gap-3">
          <label className="text-xs font-medium text-muted-foreground">
            Minimum price
            <Input
              type="number"
              min="0"
              inputMode="decimal"
              value={value.minPrice}
              onChange={(event) => set("minPrice", event.target.value)}
              placeholder="Any"
              className="mt-1"
            />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Maximum price
            <Input
              type="number"
              min="0"
              inputMode="decimal"
              value={value.maxPrice}
              onChange={(event) => set("maxPrice", event.target.value)}
              placeholder="Any"
              className="mt-1"
            />
          </label>
        </div>
        <Button type="button" variant="ghost" onClick={onClear}>
          <X aria-hidden="true" className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </section>
  )
}
