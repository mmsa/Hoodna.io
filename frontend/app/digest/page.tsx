"use client"

import type { BusinessSummary, DigestPostItem, DigestSummary } from "@hoodna/shared"
import { useQuery } from "@tanstack/react-query"
import { Bell, Building2, Loader2, MessageCircle } from "lucide-react"
import Link from "next/link"

import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DigestPage() {
  const digest = useQuery<DigestSummary | null>({
    queryKey: ["latest-digest"],
    queryFn: async () => (await api.get("/api/digests/me/latest")).data,
  })
  if (digest.isLoading) return <div className="flex min-h-screen items-center justify-center" role="status"><Loader2 className="h-8 w-8 animate-spin" /><span className="sr-only">Loading digest</span></div>
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div><h1 className="text-3xl font-bold">Your weekly digest</h1><p className="mt-2 text-gray-600">A quick look at what happened in your neighbourhood.</p></div>
        {digest.isError ? <Card><CardContent className="p-8 text-center">We could not load your digest.</CardContent></Card> : !digest.data ? <Card><CardContent className="p-8 text-center">Your first digest will appear here after a week of activity.</CardContent></Card> : (
          <DigestContent data={digest.data} />
        )}
      </div>
    </main>
  )
}

function DigestContent({ data }: { data: DigestSummary }) {
  const popularPosts: DigestPostItem[] = data.popular_posts
  const announcements: DigestPostItem[] = data.announcements
  const newBusinesses: BusinessSummary[] = data.new_businesses

  return (
    <>
      <DigestPosts title="Popular posts" icon={<MessageCircle />} items={popularPosts} />
      <DigestPosts title="Announcements" icon={<Bell />} items={announcements} />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />New businesses</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {newBusinesses.length ? newBusinesses.map((business) => (
            <Link className="block rounded-lg border p-3 hover:bg-gray-50" href={`/businesses/${business.slug}`} key={business.id}>
              {business.name}
              <span className="ml-2 text-sm text-gray-500">{business.category}</span>
            </Link>
          )) : <p className="text-sm text-gray-500">No new businesses this week.</p>}
        </CardContent>
      </Card>
    </>
  )
}

function DigestPosts({ title, icon, items }: { title: string; icon: React.ReactNode; items: DigestPostItem[] }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle></CardHeader><CardContent className="space-y-2">{items.length ? items.map((post) => <Link className="block rounded-lg border p-3 hover:bg-gray-50" href={`/feed#post-${post.id}`} key={post.id}>{post.category || "Community post"}{post.author_name ? <span className="ml-2 text-sm text-gray-500">by {post.author_name}</span> : null}</Link>) : <p className="text-sm text-gray-500">Nothing to show this week.</p>}</CardContent></Card>
}
