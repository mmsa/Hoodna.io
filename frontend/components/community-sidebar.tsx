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
    <aside className="sticky top-24 space-y-4">
      <Card className="eljiran-card border-0">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-bold text-foreground">Community</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            {totalNeighbors} verified {totalNeighbors === 1 ? "neighbour" : "neighbours"} in your compound
          </p>

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
            <p className="text-sm text-muted-foreground">
              Neighbours will appear here as they post and get verified.
            </p>
          )}

          <Button asChild variant="accent" className="mt-5 w-full">
            <Link href="/settings">Invite neighbours</Link>
          </Button>
        </CardContent>
      </Card>
    </aside>
  )
}
