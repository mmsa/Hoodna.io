"use client"

import { useEffect, useState } from "react"
import type { BusinessDirectoryResponse } from "@hoodna/shared"
import { useQuery } from "@tanstack/react-query"
import { Building2, Loader2, Search } from "lucide-react"
import Link from "next/link"

import api from "@/lib/api"
import { track } from "@/lib/telemetry"
import { BusinessVerificationBadge } from "@/components/business-verification-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function BusinessesPage() {
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(search.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const businesses = useQuery<BusinessDirectoryResponse>({
    queryKey: ["businesses", query],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" })
      if (query) params.set("search", query)
      const response = await api.get(`/api/businesses?${params}`)
      track("search_performed", {
        category: "business",
        result_count: response.data.total,
        source_screen: "business_directory",
      })
      return response.data
    },
  })

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Local businesses</h1>
          <p className="mt-2 text-gray-600">Discover services and businesses recommended across Eljiran communities.</p>
        </div>
        <label className="relative block">
          <span className="sr-only">Search businesses</span>
          <Search aria-hidden="true" className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by business name or category"
            className="h-12 pl-10"
          />
        </label>

        {businesses.isLoading ? (
          <div className="py-16 text-center" role="status">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-600" />
            <span className="sr-only">Loading businesses</span>
          </div>
        ) : businesses.isError ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="font-medium">We could not load businesses.</p>
              <Button className="mt-4" variant="outline" onClick={() => businesses.refetch()}>Try again</Button>
            </CardContent>
          </Card>
        ) : businesses.data?.items.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.data.items.map((business, position) => (
              <Link
                href={`/businesses/${encodeURIComponent(business.slug)}`}
                key={business.id}
                onClick={() => track("search_result_opened", {
                  entity_type: "business",
                  entity_id: business.id,
                  position,
                  source_screen: "business_directory",
                })}
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  {business.image_url ? (
                    <img src={business.image_url} alt="" className="h-36 w-full rounded-t-lg object-cover" />
                  ) : (
                    <div className="flex h-36 items-center justify-center rounded-t-lg bg-purple-50">
                      <Building2 className="h-10 w-10 text-purple-400" />
                    </div>
                  )}
                  <CardContent className="space-y-2 p-4">
                    <h2 className="font-semibold text-gray-900">{business.name}</h2>
                    <p className="text-sm text-gray-600">{business.category}</p>
                    <BusinessVerificationBadge status={business.verification_status} />
                    {(business.area || business.city) ? (
                      <p className="text-sm text-gray-500">{[business.area, business.city].filter(Boolean).join(", ")}</p>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-gray-300" />
              <h2 className="mt-3 font-semibold">No businesses found</h2>
              <p className="mt-1 text-sm text-gray-500">Try a different name or category.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
