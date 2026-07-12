"use client"

import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { POST_CATEGORIES } from "./types"

export type FeedFilter = "ALL" | "URGENT" | string

interface FeedFiltersProps {
  activeFilter: FeedFilter
  query: string
  onFilterChange: (filter: FeedFilter) => void
  onQueryChange: (query: string) => void
}

const filters = [
  { value: "ALL", label: "All posts" },
  { value: "URGENT", label: "Urgent" },
  ...POST_CATEGORIES,
]

export function FeedFilters({
  activeFilter,
  query,
  onFilterChange,
  onQueryChange,
}: FeedFiltersProps) {
  return (
    <div className="space-y-3 border-y border-border bg-card px-4 py-3 sm:rounded-lg sm:border">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label="Search community posts"
          placeholder="Search posts"
          className="h-11 bg-card pl-10"
        />
      </div>
      <div
        role="group"
        aria-label="Filter community posts"
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      >
        {filters.map((filter) => {
          const selected = activeFilter === filter.value
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onFilterChange(filter.value)}
              className={cn(
                "min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {filter.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
