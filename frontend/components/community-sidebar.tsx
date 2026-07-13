"use client"

import Link from "next/link"
import { Users } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { VerifiedNeighbourBadge } from "@/components/verified-neighbour-badge"
import type { Post } from "@/app/feed/components/types"

interface CommunitySidebarProps {
  totalNeighbors?: number
  posts?: Post[]
}

export function CommunitySidebar({
  totalNeighbors = 0,
  posts = [],
}: CommunitySidebarProps) {
  const verifiedAuthors = Array.from(
    new Map(
      posts
        .filter((post) => post.author_status === "APPROVED")
        .map((post) => [post.author_id, post.author_name])
    ).entries()
  ).slice(0, 6)

  return (
    <aside className="sticky top-[5.5rem] space-y-4">
      <Card className="eljiran-card">
        <CardContent className="p-5">
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
              <Users className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Community</h2>
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            {totalNeighbors} verified {totalNeighbors === 1 ? "neighbour" : "neighbours"} in your compound
          </p>

          {verifiedAuthors.length > 0 ? (
            <ul className="space-y-3.5">
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

          <Button asChild variant="accent" className="mt-5 w-full shadow-card">
            <Link href="/settings">Invite neighbours</Link>
          </Button>
        </CardContent>
      </Card>
    </aside>
  )
}
