"use client"

import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bookmark, ShoppingBag, Trash2 } from "lucide-react"

import { ListingCard } from "@/components/marketplace/listing-card"
import type { ListingView } from "@/components/marketplace/listing-meta"
import { Button } from "@/components/ui/button"
import { AppShell, PageHeader, PageLayout } from "@/components/ui/page-layout"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"

export default function SavedListingsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: listings, isLoading, error, refetch } = useQuery<ListingView[]>({
    queryKey: ["saved-listings"],
    queryFn: async () => (await api.get("/api/saved-listings")).data || [],
  })
  const mutation = useMutation({
    mutationFn: async (listingId: number) =>
      api.delete(`/api/listings/${listingId}/save`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-listings"] })
      toast({ title: "Removed from saved", variant: "success" })
    },
    onError: () =>
      toast({
        title: "Could not remove listing",
        description: "Please try again.",
        variant: "destructive",
      }),
  })

  return (
    <AppShell>
      <PageLayout width="xl" className="space-y-6">
        <PageHeader
          eyebrow="Marketplace"
          title="Saved listings"
          description="A short list of items and services you want to revisit."
          actions={<Button variant="outline" asChild><Link href="/marketplace"><ShoppingBag className="h-4 w-4" />Browse marketplace</Link></Button>}
        />
        {isLoading ? (
          <LoadingState title="Loading saved listings" />
        ) : error ? (
          <ErrorState title="Saved listings could not be loaded" action={<Button onClick={() => refetch()}>Try again</Button>} />
        ) : listings?.length ? (
          <>
            <p className="text-sm text-muted-foreground">{listings.length} saved {listings.length === 1 ? "listing" : "listings"}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={{ ...listing, is_saved: true }}
                  action={
                    <Button
                      className="w-full"
                      variant="ghost"
                      onClick={() => mutation.mutate(listing.id)}
                      disabled={mutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />Remove
                    </Button>
                  }
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Bookmark className="h-5 w-5" />}
            title="No saved listings"
            description="Save a listing to keep it here for later."
            action={<Button asChild><Link href="/marketplace">Browse marketplace</Link></Button>}
          />
        )}
      </PageLayout>
    </AppShell>
  )
}
