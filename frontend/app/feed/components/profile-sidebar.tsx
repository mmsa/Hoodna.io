"use client"

import Link from "next/link"
import {
  Building2,
  CheckCircle,
  MapPin,
  Plus,
  Star,
  User,
  Users,
} from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatCompoundWithArea } from "@/lib/format-compound"

import type { FeedSummary, ResidentUser } from "./types"

interface ProfileSidebarProps {
  user: ResidentUser
  feedSummary: FeedSummary | undefined
  userStats:
    | {
        posts_count: number
        listings_count: number
        saved_listings_count: number
      }
    | undefined
}

export function ProfileSidebar({
  user,
  feedSummary,
  userStats,
}: ProfileSidebarProps) {
  if (!user) return null

  return (
    <div className="sticky top-6 space-y-4">
      <Card className="eljiran-card border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="mb-4 flex flex-col items-center">
            <Avatar name={user.name} src={user.avatar_url} size="lg" className="mb-3" />
            <h3 className="mb-1 text-lg font-semibold text-foreground">
              {user.name}
            </h3>
            {user.status === "APPROVED" && (
              <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-primary" />
                <span>Verified</span>
              </div>
            )}
            {user.role === "ADMIN" || user.role === "MODERATOR" ? (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {user.role}
              </span>
            ) : null}
          </div>

          {userStats && (
            <div className="mb-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
              <div className="text-center">
                <div className="text-xl font-semibold text-foreground">
                  {userStats.posts_count}
                </div>
                <div className="text-xs text-muted-foreground">Posts</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-foreground">
                  {userStats.listings_count}
                </div>
                <div className="text-xs text-muted-foreground">Listings</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-foreground">
                  {userStats.saved_listings_count}
                </div>
                <div className="text-xs text-muted-foreground">Saved</div>
              </div>
            </div>
          )}

          <div className="space-y-2 border-t border-border pt-4">
            <Link href="/marketplace/new">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create Listing
              </Button>
            </Link>
            <Link href="/profile">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <User className="mr-2 h-4 w-4" />
                View Profile
              </Button>
            </Link>
            <Link href="/saved">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Star className="mr-2 h-4 w-4" />
                Saved Items
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {feedSummary?.compound_name && (
        <Card className="eljiran-card border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-foreground">My Neighbourhood</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="font-medium text-foreground">
                  {formatCompoundWithArea(
                    feedSummary.compound_name,
                    feedSummary.compound_area
                  )}
                </div>
              </div>
              {feedSummary.compound_developer && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs">{feedSummary.compound_developer}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {feedSummary && (
        <Card className="eljiran-card border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-foreground">Community</h4>
            </div>
            <dl className="space-y-3">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">Neighbors</dt>
                <dd className="text-sm font-medium text-foreground">
                  {feedSummary.total_neighbors || 0}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">Recent Posts</dt>
                <dd className="text-sm font-medium text-foreground">
                  {feedSummary.recent_posts_count || 0}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">Listings</dt>
                <dd className="text-sm font-medium text-foreground">
                  {feedSummary.recent_listings_count || 0}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
