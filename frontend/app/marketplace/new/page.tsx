"use client"

import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, AlertCircle, Car, Home, Lock, Package } from "lucide-react"
import type { ListingCategory } from "@hoodna/shared"

import {
  ListingForm,
  type ListingFormValues,
} from "@/components/marketplace/listing-form"
import { Button } from "@/components/ui/button"
import { AppShell, PageHeader, PageLayout } from "@/components/ui/page-layout"
import { ErrorState, LoadingState } from "@/components/ui/states"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"
import { isResidentRole } from "@/lib/resident-routing"

const MARKET_CATEGORIES: Array<{
  value: Exclude<ListingCategory, "SERVICE">
  title: string
  description: string
  icon: typeof Package
}> = [
  { value: "ITEM", title: "Sell an item", description: "Furniture, electronics, home goods and more.", icon: Package },
  { value: "CAR", title: "Sell a car", description: "Share the key vehicle details buyers need.", icon: Car },
  { value: "PROPERTY", title: "List a property", description: "Offer a home for sale or rent.", icon: Home },
]

export default function NewListingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { user, isLoading: userLoading } = useAuth()
  const { toast } = useToast()
  const requestedCategory = searchParams?.get("category")
  const category =
    requestedCategory === "ITEM" ||
    requestedCategory === "CAR" ||
    requestedCategory === "PROPERTY" ||
    requestedCategory === "SERVICE"
      ? requestedCategory
      : null
  const serviceRequest = category === "SERVICE"
  const provider = user?.role === "SERVICE_PROVIDER"

  const { data: providerProfile, isLoading: providerProfileLoading } = useQuery({
    queryKey: ["provider-profile"],
    queryFn: async () => (await api.get("/api/providers/me")).data,
    enabled: provider,
    retry: false,
  })
  const { data: currentListings = [], isLoading: listingsLoading } = useQuery<any[]>({
    queryKey: ["my-services"],
    queryFn: async () =>
      (await api.get("/api/listings?scope=my&category=SERVICE&limit=100")).data || [],
    enabled: provider && !!providerProfile,
    retry: false,
  })

  const maxListings = providerProfile?.max_listings || 3
  const atLimit = serviceRequest && currentListings.length >= maxListings
  const providerApproved =
    providerProfile?.provider_status?.toString().trim().toUpperCase() === "APPROVED"
  const canCreateService =
    serviceRequest && provider && user?.can_create_listing === true && providerApproved
  const canCreateMarketplace =
    !serviceRequest && isResidentRole(user?.role) && user?.can_create_listing === true

  const mutation = useMutation({
    mutationFn: async (values: ListingFormValues) =>
      (await api.post("/api/listings", values)).data,
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ["listings"] })
      queryClient.invalidateQueries({ queryKey: ["services"] })
      queryClient.invalidateQueries({ queryKey: ["my-services"] })
      toast({
        title: "Listing created",
        description: "Your listing is now live.",
        variant: "success",
      })
      router.push(serviceRequest ? "/services" : `/listing/${listing.id}`)
    },
    onError: (error: any) =>
      toast({
        title: "Could not create listing",
        description: error?.response?.data?.detail || "Please try again.",
        variant: "destructive",
      }),
  })

  if (userLoading || (provider && (providerProfileLoading || (providerProfile && listingsLoading)))) {
    return <AppShell><PageLayout width="md"><LoadingState title="Checking listing access" /></PageLayout></AppShell>
  }

  if ((serviceRequest && !canCreateService) || (!serviceRequest && !canCreateMarketplace)) {
    return (
      <AppShell>
        <PageLayout width="sm">
          <ErrorState
            icon={<Lock className="h-5 w-5" />}
            title="You can’t create this listing"
            description={
              serviceRequest
                ? "Only approved service providers with listing permission can publish services."
                : "Marketplace posting is available to approved residents with listing permission."
            }
            action={<Button asChild><Link href={serviceRequest ? "/services" : "/marketplace"}>Go back</Link></Button>}
          />
        </PageLayout>
      </AppShell>
    )
  }

  if (!category) {
    return (
      <AppShell>
        <PageLayout width="md" className="space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/marketplace"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Back to marketplace</Link>
          </Button>
          <PageHeader
            eyebrow="Marketplace"
            title="What are you listing?"
            description="Choose a category to see the right details for your listing."
          />
          <div className="grid gap-3">
            {MARKET_CATEGORIES.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.value}
                  href={`/marketplace/new?category=${item.value}`}
                  aria-label={item.title}
                  className="flex min-h-24 items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon aria-hidden="true" className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block font-semibold">{item.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{item.description}</span>
                  </span>
                </Link>
              )
            })}
          </div>
        </PageLayout>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageLayout width="md" className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href={serviceRequest ? "/services" : "/marketplace"}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {serviceRequest ? "Back to services" : "Back to marketplace"}
          </Link>
        </Button>
        <PageHeader
          eyebrow={serviceRequest ? "Services" : "Marketplace"}
          title={serviceRequest ? "Add a service" : "Create a listing"}
          description="Provide the essentials first. You can update the listing later."
        />
        {serviceRequest && providerProfile ? (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p>
              {atLimit
                ? `You have reached your limit of ${maxListings} service listings.`
                : `${maxListings - currentListings.length} of ${maxListings} service listing slots remain.`}
            </p>
          </div>
        ) : null}
        <ListingForm
          key={category}
          initialValues={{ category }}
          submitting={mutation.isPending}
          submitLabel="Publish listing"
          onCancel={() => router.push(serviceRequest ? "/services" : "/marketplace")}
          onChangeCategory={
            serviceRequest ? undefined : () => router.push("/marketplace/new")
          }
          onSubmit={(values) => {
            if (atLimit) {
              toast({
                title: "Listing limit reached",
                description: "Remove an existing service before creating another.",
                variant: "destructive",
              })
              return
            }
            mutation.mutate(values)
          }}
        />
      </PageLayout>
    </AppShell>
  )
}
