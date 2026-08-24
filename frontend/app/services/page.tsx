"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Plus, Search, Wrench } from "lucide-react"
import type { ServiceCategory } from "@hoodna/shared"

import { ListingCard } from "@/components/marketplace/listing-card"
import {
  LISTING_SORT_OPTIONS,
  type ListingView,
} from "@/components/marketplace/listing-meta"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AppShell, PageHeader, PageLayout } from "@/components/ui/page-layout"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { useAuth } from "@/hooks/use-auth"
import api from "@/lib/api"
import { formatCompoundName } from "@/lib/format-compound"
import { cn } from "@/lib/utils"

function listingMatchesCategory(listing: ListingView, category: ServiceCategory): boolean {
  const haystack = `${listing.title} ${listing.description || ""}`.toLowerCase()
  const name = category.name.toLowerCase()
  if (haystack.includes(name)) return true
  const tokens = name
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 2 && token !== "and" && token !== "the")
  return tokens.some((token) => haystack.includes(token))
}

export default function ServicesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState("date_desc")
  const [intent, setIntent] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const provider = user?.role === "SERVICE_PROVIDER"

  const { data: providerProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["provider-profile"],
    queryFn: async () => {
      try {
        return (await api.get("/api/providers/me")).data
      } catch {
        return null
      }
    },
    enabled: provider,
    retry: false,
  })
  useEffect(() => {
    if (!provider || profileLoading) return
    const status = providerProfile?.provider_status?.toString().trim().toUpperCase()
    if (status !== "APPROVED") router.replace("/provider/status")
  }, [profileLoading, provider, providerProfile, router])

  const { data: feedSummary } = useQuery({
    queryKey: ["feed-summary"],
    queryFn: async () => (await api.get("/api/feed/summary")).data,
    enabled: !!user && !provider && user.role !== "COMPOUND_MOD",
    retry: false,
  })
  const compoundName = feedSummary?.compound_name
    ? formatCompoundName(feedSummary.compound_name)
    : "your compound"

  const { data: categories = [] } = useQuery<ServiceCategory[]>({
    queryKey: ["service-categories"],
    queryFn: async () => (await api.get("/api/service-categories")).data || [],
    enabled: !!user && !provider,
    staleTime: 5 * 60 * 1000,
  })

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      scope: provider ? "my" : "compound",
      category: "SERVICE",
      sort_by: sort,
      limit: "100",
    })
    if (search.trim()) params.set("search", search.trim())
    if (intent) params.set("intent", intent)
    return params.toString()
  }, [intent, provider, search, sort])

  const enabled =
    !!user &&
    (!provider ||
      (!profileLoading &&
        providerProfile?.provider_status?.toString().trim().toUpperCase() ===
          "APPROVED"))
  const { data: services, isLoading, error, refetch } = useQuery<ListingView[]>({
    queryKey: ["services", user?.role, queryParams],
    queryFn: async () => (await api.get(`/api/listings?${queryParams}`)).data || [],
    enabled,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) || null,
    [categories, selectedCategoryId],
  )

  const visibleServices = useMemo(() => {
    if (!services) return []
    if (!selectedCategory || search.trim()) return services
    return services.filter((service) => listingMatchesCategory(service, selectedCategory))
  }, [services, selectedCategory, search])

  useEffect(() => {
    if (!error) return
    const status = (error as any)?.response?.status
    if (status === 403) router.push("/verification")
    if (status === 400 && provider) router.push("/provider/status")
  }, [error, provider, router])

  if (isLoading || (provider && profileLoading)) {
    return <AppShell><PageLayout width="xl"><LoadingState title="Loading services" /></PageLayout></AppShell>
  }

  const canCreate =
    provider &&
    user?.can_create_listing === true &&
    providerProfile?.provider_status?.toString().trim().toUpperCase() ===
      "APPROVED"
  const atListingLimit =
    canCreate && (services?.length ?? 0) >= (providerProfile?.max_listings || 3)
  const createAction = canCreate ? (
    atListingLimit ? (
      <Button disabled title="Delete a service before adding another">Listing limit reached</Button>
    ) : (
      <Button asChild><Link href="/marketplace/new?category=SERVICE"><Plus className="h-4 w-4" />Add service</Link></Button>
    )
  ) : undefined

  return (
    <AppShell>
      <PageLayout width="xl" className="space-y-6">
        <PageHeader
          eyebrow={provider ? "Provider workspace" : "Your community"}
          title={provider ? "My services" : "Services"}
          description={provider ? "Manage the services residents can discover." : `Find local service providers in ${compoundName}.`}
          actions={createAction}
        />

        {!provider && categories.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">Categories</h2>
              {selectedCategoryId ? (
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={() => setSelectedCategoryId(null)}
                >
                  Clear filter
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {categories.map((category) => {
                const active = selectedCategoryId === category.id
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSearch("")
                      setSelectedCategoryId(active ? null : category.id)
                    }}
                    className={cn(
                      "flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center transition-colors",
                      active
                        ? "border-primary bg-secondary text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/40",
                    )}
                  >
                    <span className="text-xl" aria-hidden>
                      {category.icon || "🔧"}
                    </span>
                    <span className="text-xs font-semibold leading-tight">{category.name}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ) : null}

        <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_180px_200px]">
          <label className="relative">
            <span className="sr-only">Search services</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                if (event.target.value.trim()) setSelectedCategoryId(null)
              }}
              placeholder="Search services"
              className="pl-9"
            />
          </label>
          <Select value={intent || "all"} onValueChange={(value) => setIntent(value === "all" ? "" : value)}>
            <SelectTrigger aria-label="Service pricing"><SelectValue placeholder="Any pricing" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any pricing</SelectItem>
              <SelectItem value="SELL">One-time</SelectItem>
              <SelectItem value="RENT">Hourly</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger aria-label="Sort services"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LISTING_SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {selectedCategory ? (
          <p className="text-sm font-medium text-foreground">
            Showing: {selectedCategory.name}
          </p>
        ) : null}

        {error ? (
          <ErrorState title="Services could not be loaded" description="Check your connection and try again." action={<Button onClick={() => refetch()}>Try again</Button>} />
        ) : visibleServices.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleServices.map((service) => <ListingCard key={service.id} listing={service} />)}
          </div>
        ) : (
          <EmptyState
            icon={<Wrench className="h-5 w-5" />}
            title={search || selectedCategory ? "No matching services" : provider ? "No services yet" : "No services available"}
            description={
              search || selectedCategory
                ? "Try another search or category."
                : provider
                  ? "Publish your first service so residents can find you."
                  : `No providers have listed a service in ${compoundName} yet.`
            }
            action={createAction}
          />
        )}
      </PageLayout>
    </AppShell>
  )
}
