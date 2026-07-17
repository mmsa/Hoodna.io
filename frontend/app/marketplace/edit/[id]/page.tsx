"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"

import {
  ListingForm,
  type ListingFormValues,
} from "@/components/marketplace/listing-form"
import type { ListingView } from "@/components/marketplace/listing-meta"
import { Button } from "@/components/ui/button"
import { AppShell, PageHeader, PageLayout } from "@/components/ui/page-layout"
import { ErrorState, LoadingState } from "@/components/ui/states"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"

export default function EditListingPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { toast } = useToast()
  const listingId = Number(params?.id)

  const { data: listing, isLoading, error, refetch } = useQuery<ListingView>({
    queryKey: ["listing", listingId],
    queryFn: async () => (await api.get(`/api/listings/${listingId}`)).data,
    enabled: Number.isFinite(listingId),
  })

  useEffect(() => {
    if (listing && user && listing.owner_id !== user.id) {
      toast({
        title: "Access denied",
        description: "Only the listing owner can edit it.",
        variant: "destructive",
      })
      router.replace(`/listing/${listingId}`)
    }
  }, [listing, listingId, router, toast, user])

  const mutation = useMutation({
    mutationFn: async (values: ListingFormValues) =>
      (
        await api.patch(`/api/listings/${listingId}`, {
          title: values.title,
          description: values.description ?? null,
          price: values.price,
          attributes: values.attributes,
          image_urls: values.image_urls,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listing", listingId] })
      queryClient.invalidateQueries({ queryKey: ["listings"] })
      queryClient.invalidateQueries({ queryKey: ["services"] })
      queryClient.invalidateQueries({ queryKey: ["my-services"] })
      toast({
        title: "Listing updated",
        description: "Your changes have been saved.",
        variant: "success",
      })
      router.push(`/listing/${listingId}`)
    },
    onError: (mutationError: any) =>
      toast({
        title: "Could not update listing",
        description:
          mutationError?.response?.data?.detail || "Please try again.",
        variant: "destructive",
      }),
  })

  if (isLoading) {
    return <AppShell><PageLayout width="md"><LoadingState title="Loading listing" /></PageLayout></AppShell>
  }
  if (error || !listing) {
    return (
      <AppShell>
        <PageLayout width="md">
          <ErrorState
            title="Listing could not be loaded"
            description="It may have been removed or you may not have access."
            action={<Button onClick={() => refetch()}>Try again</Button>}
          />
        </PageLayout>
      </AppShell>
    )
  }

  const service = listing.category === "SERVICE"
  const backUrl = service && user?.role === "SERVICE_PROVIDER" ? "/services" : `/listing/${listing.id}`

  return (
    <AppShell>
      <PageLayout width="md" className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href={backUrl}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <PageHeader
          eyebrow={service ? "Service listing" : "Marketplace"}
          title="Edit listing"
          description="Keep the information accurate and remove photos that are no longer relevant."
        />
        <ListingForm
          key={listing.id}
          intentLocked
          initialValues={{
            category: listing.category,
            title: listing.title,
            description: listing.description ?? "",
            price: listing.price,
            intent: listing.intent,
            attributes: listing.attributes,
            image_urls: listing.image_urls,
          }}
          submitting={mutation.isPending}
          submitLabel="Save changes"
          onCancel={() => router.push(backUrl)}
          onSubmit={(values) => mutation.mutate(values)}
        />
      </PageLayout>
    </AppShell>
  )
}
