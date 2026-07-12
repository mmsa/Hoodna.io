"use client"

import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, AlertCircle } from "lucide-react"

import {
  ListingForm,
  type ListingFormValues,
} from "@/components/marketplace/listing-form"
import { Button } from "@/components/ui/button"
import { AppShell, PageHeader, PageLayout } from "@/components/ui/page-layout"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"

export default function NewListingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { toast } = useToast()
  const serviceOnly = user?.role === "SERVICE_PROVIDER"

  const { data: providerProfile } = useQuery({
    queryKey: ["provider-profile"],
    queryFn: async () => (await api.get("/api/providers/me")).data,
    enabled: serviceOnly,
    retry: false,
  })
  const { data: currentListings = [] } = useQuery<any[]>({
    queryKey: ["my-services"],
    queryFn: async () =>
      (await api.get("/api/listings?scope=my&category=SERVICE")).data || [],
    enabled: serviceOnly && !!providerProfile,
    retry: false,
  })

  const maxListings = providerProfile?.max_listings || 3
  const atLimit = serviceOnly && currentListings.length >= maxListings
  const requestedCategory = searchParams?.get("category")
  const category =
    serviceOnly || requestedCategory === "SERVICE"
      ? "SERVICE"
      : requestedCategory === "CAR" || requestedCategory === "PROPERTY"
        ? requestedCategory
        : "ITEM"

  const mutation = useMutation({
    mutationFn: async (
      values: ListingFormValues & { image_urls: string[] }
    ) =>
      (
        await api.post("/api/listings", {
          ...values,
          price: values.price ? Number(values.price) : null,
        })
      ).data,
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ["listings"] })
      queryClient.invalidateQueries({ queryKey: ["services"] })
      queryClient.invalidateQueries({ queryKey: ["my-services"] })
      toast({
        title: "Listing created",
        description: "Your listing is now live.",
        variant: "success",
      })
      router.push(serviceOnly ? "/services" : `/listing/${listing.id}`)
    },
    onError: (error: any) =>
      toast({
        title: "Could not create listing",
        description: error?.response?.data?.detail || "Please try again.",
        variant: "destructive",
      }),
  })

  return (
    <AppShell>
      <PageLayout width="md" className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href={serviceOnly ? "/services" : "/marketplace"}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {serviceOnly ? "Back to services" : "Back to marketplace"}
          </Link>
        </Button>
        <PageHeader
          eyebrow={serviceOnly ? "Services" : "Marketplace"}
          title={serviceOnly ? "Add a service" : "Create a listing"}
          description="Provide the essentials first. You can update the listing later."
        />
        {serviceOnly && providerProfile ? (
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
          initialValues={{ category }}
          serviceOnly={serviceOnly}
          submitting={mutation.isPending}
          submitLabel="Publish listing"
          onCancel={() => router.push(serviceOnly ? "/services" : "/marketplace")}
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
