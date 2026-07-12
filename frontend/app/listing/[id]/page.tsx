"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  Edit,
  MapPin,
  MessageCircle,
  Trash2,
  TrendingUp,
  User,
} from "lucide-react"

import { ListingGallery } from "@/components/marketplace/listing-gallery"
import {
  categoryMeta,
  formatListingPrice,
  intentLabel,
  type ListingView,
} from "@/components/marketplace/listing-meta"
import { ReportListing } from "@/components/marketplace/report-listing"
import { ReviewForm } from "@/components/review-form"
import { ReviewsList } from "@/components/reviews-list"
import { Button } from "@/components/ui/button"
import { Rating } from "@/components/ui/rating"
import { AppShell, PageLayout, Section } from "@/components/ui/page-layout"
import { ErrorState, LoadingState } from "@/components/ui/states"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"
import { shareViaWhatsApp } from "@/lib/share"

export default function ListingPage({ params }: { params: { id: string } }) {
  const listingId = Number(params.id)
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: listing, isLoading, error, refetch } = useQuery<ListingView>({
    queryKey: ["listing", listingId],
    queryFn: async () => (await api.get(`/api/listings/${listingId}`)).data,
    enabled: Number.isFinite(listingId),
  })

  const saveMutation = useMutation({
    mutationFn: async (saved: boolean) =>
      saved
        ? api.delete(`/api/listings/${listingId}/save`)
        : api.post(`/api/listings/${listingId}/save`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listing", listingId] })
      queryClient.invalidateQueries({ queryKey: ["saved-listings"] })
      toast({
        title: listing?.is_saved ? "Removed from saved" : "Listing saved",
        variant: "success",
      })
    },
    onError: (mutationError: any) =>
      toast({
        title: "Could not update saved status",
        description: mutationError?.response?.data?.detail || "Please try again.",
        variant: "destructive",
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => api.delete(`/api/listings/${listingId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] })
      queryClient.invalidateQueries({ queryKey: ["services"] })
      toast({ title: "Listing deleted", variant: "success" })
      router.push(listing?.category === "SERVICE" ? "/services" : "/marketplace")
    },
    onError: (mutationError: any) =>
      toast({
        title: "Could not delete listing",
        description: mutationError?.response?.data?.detail || "Please try again.",
        variant: "destructive",
      }),
  })

  if (isLoading) {
    return <AppShell><PageLayout width="lg"><LoadingState title="Loading listing" /></PageLayout></AppShell>
  }
  if (error || !listing) {
    return (
      <AppShell><PageLayout width="lg">
        <ErrorState title="Listing not found" description="It may have been removed or is no longer available." action={<Button onClick={() => refetch()}>Try again</Button>} />
      </PageLayout></AppShell>
    )
  }

  const isOwner = listing.owner_id === user?.id
  const isService = listing.category === "SERVICE"
  const category = categoryMeta(listing.category)
  const CategoryIcon = category.icon
  const backUrl = isService && user?.role === "SERVICE_PROVIDER" ? "/services" : "/marketplace"

  async function shareListing() {
    shareViaWhatsApp({ title: listing!.title, url: window.location.href })
  }

  return (
    <AppShell>
      <PageLayout width="lg" className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href={backUrl}><ArrowLeft className="h-4 w-4" />Back to {isService ? "services" : "marketplace"}</Link>
        </Button>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            <ListingGallery images={listing.image_urls || []} title={listing.title} />
            <Section title="Description">
              <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                {listing.description || "No description provided."}
              </p>
            </Section>
            {isService ? (
              <div className="space-y-5 border-t border-border pt-8">
                {!isOwner ? <ReviewForm listingId={listing.id} /> : null}
                <ReviewsList listingId={listing.id} />
              </div>
            ) : null}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="eljiran-card p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CategoryIcon className="h-4 w-4" />
                <span>{category.label}</span><span>·</span>
                <span>{intentLabel(listing.intent, isService)}</span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold leading-8 tracking-tight">{listing.title}</h1>
              <p className="mt-3 text-[28px] font-extrabold leading-none text-primary">
                {formatListingPrice(listing.price, listing.currency, isService)}
              </p>
              {isService && listing.average_rating ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Rating rating={listing.average_rating} size="sm" />
                  <span>{listing.review_count ?? 0} reviews</span>
                </div>
              ) : null}

              <dl className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
                {listing.compound_name ? (
                  <div className="flex gap-3"><MapPin className="h-4 w-4 text-muted-foreground" /><div><dt className="sr-only">Location</dt><dd>{listing.compound_name}</dd></div></div>
                ) : null}
                <div className="flex gap-3"><User className="h-4 w-4 text-muted-foreground" /><div><dt className="sr-only">Listed by</dt><dd>{listing.owner_name}</dd></div></div>
                <div className="flex gap-3"><Calendar className="h-4 w-4 text-muted-foreground" /><div><dt className="sr-only">Listed on</dt><dd>{new Date(listing.created_at).toLocaleDateString(undefined, { dateStyle: "long" })}</dd></div></div>
              </dl>

              <div className="mt-6 space-y-2">
                {!isOwner ? (
                  <>
                    <Button className="w-full" variant="outline" asChild>
                      <Link href={`/messages/new?recipient_id=${listing.owner_id}&listing_id=${listing.id}`}>
                        <MessageCircle className="h-4 w-4" />Message seller
                      </Link>
                    </Button>
                    <Button className="w-full" variant="whatsapp" onClick={shareListing}>
                      Share on WhatsApp
                    </Button>
                  </>
                ) : (
                  <>
                    <Button className="w-full" asChild><Link href={`/marketplace/edit/${listing.id}`}><Edit className="h-4 w-4" />Edit listing</Link></Button>
                    <Button className="w-full" variant="outline" asChild><Link href={`/promote/${listing.id}`}><TrendingUp className="h-4 w-4" />Promote listing</Link></Button>
                    <Button
                      className="w-full"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => window.confirm("Delete this listing permanently?") && deleteMutation.mutate()}
                    ><Trash2 className="h-4 w-4" />{deleteMutation.isPending ? "Deleting…" : "Delete listing"}</Button>
                  </>
                )}
                {!isOwner ? (
                  <Button
                    className="w-full"
                    variant={listing.is_saved ? "secondary" : "outline"}
                    onClick={() => saveMutation.mutate(Boolean(listing.is_saved))}
                    disabled={saveMutation.isPending}
                  ><Bookmark className={listing.is_saved ? "h-4 w-4 fill-current" : "h-4 w-4"} />{listing.is_saved ? "Saved" : "Save listing"}</Button>
                ) : null}
              </div>
            </div>
            {!isOwner ? <ReportListing listingId={listing.id} /> : null}
          </aside>
        </div>
      </PageLayout>
    </AppShell>
  )
}
