"use client"

import Link from "next/link"
import { CalendarDays, CheckCircle2, MessageCircle, ShoppingBag, Users } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { VerifiedNeighbourBadge } from "@/components/verified-neighbour-badge"
import type { Post } from "@/app/feed/components/types"

interface CommunitySidebarProps {
  totalNeighbors?: number
  recentPosts?: number
  recentListings?: number
  posts?: Post[]
}

export function CommunitySidebar({
  totalNeighbors = 0,
  recentPosts = 0,
  recentListings = 0,
  posts = [],
}: CommunitySidebarProps) {
  const verifiedAuthors = Array.from(
    new Map(
      posts
        .filter((post) => post.author_status === "APPROVED")
        .map((post) => [post.author_id, post.author_name])
    ).entries()
  ).slice(0, 6)
  const events = posts.filter((post) => post.category === "EVENT").slice(0, 2)

  return (
    <aside className="sticky top-[5.5rem] space-y-4">
      <Card className="eljiran-card">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Community overview
              </p>
              <div className="mt-2 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Verified & active</h2>
              </div>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
              LIVE
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: Users, value: totalNeighbors, label: "Neighbours" },
              { icon: MessageCircle, value: recentPosts, label: "Posts" },
              { icon: ShoppingBag, value: recentListings, label: "Listings" },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="rounded-xl bg-muted/55 px-2 py-3 text-center">
                <Icon className="mx-auto h-4 w-4 text-primary" />
                <p className="mt-1.5 text-sm font-bold text-foreground">{value}</p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="eljiran-card">
        <CardContent className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Active neighbours</h3>
            <span className="text-[10px] text-muted-foreground">{verifiedAuthors.length} shown</span>
          </div>

          {verifiedAuthors.length > 0 ? (
            <ul className="space-y-3">
              {verifiedAuthors.map(([id, name]) => (
                <li key={id} className="flex items-center gap-3">
                  <Avatar name={name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                    <VerifiedNeighbourBadge compact className="mt-0.5" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-muted/50 px-3 py-4 text-sm leading-relaxed text-muted-foreground">
              Neighbours will appear here as they post and get verified.
            </p>
          )}
        </CardContent>
      </Card>

      {events.length > 0 ? (
        <Card className="eljiran-card">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Upcoming events</h3>
            </div>
            <div className="space-y-3">
              {events.map((event) => (
                <Link key={event.id} href={`/feed#post-${event.id}`} className="block rounded-xl bg-muted/45 p-3">
                  <p className="line-clamp-2 text-xs font-semibold leading-5 text-foreground">
                    {event.content}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{event.author_name}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="overflow-hidden rounded-[16px] bg-[#07534f] p-4 text-white shadow-card">
        <p className="text-sm font-bold">Grow your community</p>
        <p className="mt-1 text-xs leading-5 text-white/70">
          Invite neighbours you know and make local updates more useful.
        </p>
        <Button asChild variant="accent" size="sm" className="mt-4 w-full">
          <Link href="/settings">Invite neighbours</Link>
        </Button>
      </div>
    </aside>
  )
}
