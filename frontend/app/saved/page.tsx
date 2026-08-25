"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bookmark, ShoppingBag, Trash2 } from "lucide-react"
import type { Post } from "@hoodna/shared"

import { ListingCard } from "@/components/marketplace/listing-card"
import type { ListingView } from "@/components/marketplace/listing-meta"
import { Button } from "@/components/ui/button"
import { AppShell, PageHeader, PageLayout } from "@/components/ui/page-layout"
import { EmptyState, LoadingState } from "@/components/ui/states"
import api from "@/lib/api"
import { cn } from "@/lib/utils"

export default function SavedPage() {
  const [tab, setTab] = useState<"posts" | "listings">("posts")
  const queryClient = useQueryClient()
  const posts = useQuery<Post[]>({ queryKey: ["saved-posts"], queryFn: async () => (await api.get("/api/saved-posts")).data || [] })
  const listings = useQuery<ListingView[]>({ queryKey: ["saved-listings"], queryFn: async () => (await api.get("/api/saved-listings")).data || [] })
  const removePost = useMutation({
    mutationFn: (id: number) => api.delete(`/api/posts/${id}/save`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-posts"] }),
  })
  const removeListing = useMutation({
    mutationFn: (id: number) => api.delete(`/api/listings/${id}/save`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-listings"] }),
  })

  return (
    <AppShell>
      <PageLayout width="xl" className="space-y-6">
        <PageHeader eyebrow="Your collection" title="Saved" description="Posts and listings you want to revisit." />
        <div className="flex gap-2 border-b border-border">
          {(["posts", "listings"] as const).map((value) => (
            <button key={value} onClick={() => setTab(value)} className={cn("border-b-2 px-4 py-3 text-sm font-semibold capitalize", tab === value ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>
              {value}
            </button>
          ))}
        </div>
        {tab === "posts" ? (
          posts.isLoading ? <LoadingState title="Loading saved posts" /> :
          posts.data?.length ? (
            <div className="space-y-3">
              {posts.data.map((post) => (
                <article key={post.id} className="eljiran-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/feed#post-${post.id}`} className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase text-primary">{post.category || "General"}</p>
                      <p className="mt-1 line-clamp-3 text-sm leading-6">{post.content}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{post.author_name}</p>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => removePost.mutate(post.id)}><Trash2 className="h-4 w-4" />Remove</Button>
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState icon={<Bookmark className="h-5 w-5" />} title="No saved posts" description="Bookmark a post to keep it here." />
        ) : (
          listings.isLoading ? <LoadingState title="Loading saved listings" /> :
          listings.data?.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.data.map((listing) => <ListingCard key={listing.id} listing={{ ...listing, is_saved: true }} action={<Button variant="ghost" className="w-full" onClick={() => removeListing.mutate(listing.id)}><Trash2 className="h-4 w-4" />Remove</Button>} />)}
            </div>
          ) : <EmptyState icon={<ShoppingBag className="h-5 w-5" />} title="No saved listings" description="Save a marketplace listing to keep it here." />
        )}
      </PageLayout>
    </AppShell>
  )
}

