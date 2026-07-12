"use client"

import { useState } from "react"
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
import { cn } from "@/lib/utils"
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
  const [showAdvanced, setShowAdvanced] = useState(false)
  const set = (key: keyof ListingFilterValues, next: string) =>
    onChange({ ...value, [key]: next })

  const categories = includeServices
    ? LISTING_CATEGORIES
    : LISTING_CATEGORIES.filter((category) => category.value !== "SERVICE")

  const quickCategories = categories.filter((c) => c.value)

  return (
    <section aria-label="Marketplace filters" className="space-y-3">
      {/* WhatsApp-style search bar */}
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={value.search}
          onChange={(event) => set("search", event.target.value)}
          placeholder="Search what neighbours are selling…"
          className="eljiran-search w-full"
        />
      </div>

      {/* Category chips — horizontal scroll like social filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => set("category", "")}
          className={cn(
            "eljiran-pill shrink-0 border",
            !value.category
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          All
        </button>
        {quickCategories.map((category) => (
          <button
            key={category.value}
            type="button"
            onClick={() =>
              set("category", value.category === category.value ? "" : category.value)
            }
            className={cn(
              "eljiran-pill shrink-0 border",
              value.category === category.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            {category.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowAdvanced((open) => !open)}
          className="eljiran-pill shrink-0 border border-border bg-card text-muted-foreground hover:bg-muted"
        >
          <SlidersHorizontal className="mr-1 inline h-3.5 w-3.5" />
          More
        </button>
      </div>

      {showAdvanced ? (
        <div className="eljiran-card p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              value={value.intent || "all"}
              onValueChange={(next) => set("intent", next === "all" ? "" : next)}
            >
              <SelectTrigger aria-label="Listing type" className="rounded-xl">
                <SelectValue placeholder="Buy or rent" />
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
              <SelectTrigger aria-label="Sort listings" className="rounded-xl">
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
            <Button type="button" variant="ghost" onClick={onClear} className="rounded-xl">
              <X className="h-4 w-4" />
              Clear all
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Input
              type="number"
              min="0"
              inputMode="decimal"
              value={value.minPrice}
              onChange={(event) => set("minPrice", event.target.value)}
              placeholder="Min price (EGP)"
              className="rounded-xl"
            />
            <Input
              type="number"
              min="0"
              inputMode="decimal"
              value={value.maxPrice}
              onChange={(event) => set("maxPrice", event.target.value)}
              placeholder="Max price (EGP)"
              className="rounded-xl"
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}
