"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { PublicUserProfileSchema, type PublicUserProfile } from "@hoodna/shared"
import {
  ArrowLeft,
  Calendar,
  Home,
  Mail,
  MessageCircle,
  Phone,
  Settings,
  Shield,
} from "lucide-react"

import { VerifiedNeighbourBadge } from "@/components/verified-neighbour-badge"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AppShell, PageLayout } from "@/components/ui/page-layout"
import { ErrorState, LoadingState } from "@/components/ui/states"
import { useAuth } from "@/hooks/use-auth"
import api from "@/lib/api"
import { formatCompoundName } from "@/lib/format-compound"

export default function NeighbourProfilePage() {
  const params = useParams<{ id: string }>()
  const userId = Number(params?.id)
  const { user } = useAuth()

  const { data, isLoading, error, refetch } = useQuery<PublicUserProfile>({
    queryKey: ["public-profile", userId],
    queryFn: async () =>
      PublicUserProfileSchema.parse((await api.get(`/api/users/${userId}/profile`)).data),
    enabled: Number.isFinite(userId) && userId > 0,
    retry: false,
  })

  if (!Number.isFinite(userId) || userId <= 0) {
    return (
      <AppShell>
        <PageLayout width="md">
          <ErrorState title="Profile not found" description="This neighbour link is invalid." />
        </PageLayout>
      </AppShell>
    )
  }

  if (isLoading) {
    return (
      <AppShell>
        <PageLayout width="md" className="flex min-h-[40vh] items-center justify-center">
          <LoadingState title="Loading profile" />
        </PageLayout>
      </AppShell>
    )
  }

  if (error || !data) {
    return (
      <AppShell>
        <PageLayout width="md">
          <ErrorState
            title="Profile unavailable"
            description="This neighbour may have left or their profile is private."
            action={
              <Button onClick={() => refetch()} variant="outline">
                Try again
              </Button>
            }
          />
        </PageLayout>
      </AppShell>
    )
  }

  const joinedLabel = data.joined_at
    ? new Date(data.joined_at).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null

  return (
    <AppShell>
      <PageLayout width="md" className="space-y-6 pb-10">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/feed">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>

        <Card className="eljiran-card border-0 overflow-hidden">
          <div className="h-24 bg-gradient-to-br from-primary/20 via-primary/10 to-muted" />
          <CardContent className="-mt-10 space-y-5 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div className="rounded-full ring-4 ring-card">
                  <Avatar name={data.name} src={data.avatar_url} size="lg" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      {data.name}
                    </h1>
                    {data.is_verified ? <VerifiedNeighbourBadge compact /> : null}
                  </div>
                  {data.compound_name ? (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Home className="h-3.5 w-3.5" />
                      {formatCompoundName(data.compound_name)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {data.is_own_profile ? (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/profile">
                        <Settings className="h-4 w-4" />
                        Edit profile
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/settings">Privacy</Link>
                    </Button>
                  </>
                ) : user ? (
                  <Button size="sm" asChild>
                    <Link href={`/messages/new?recipient_id=${data.id}`}>
                      <MessageCircle className="h-4 w-4" />
                      Message
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              {joinedLabel ? (
                <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                  <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Member since
                    </dt>
                    <dd className="text-sm font-medium text-foreground">{joinedLabel}</dd>
                  </div>
                </div>
              ) : null}
              {data.phone ? (
                <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                  <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Phone
                    </dt>
                    <dd className="text-sm font-medium text-foreground">{data.phone}</dd>
                  </div>
                </div>
              ) : null}
              {data.email ? (
                <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                  <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Email
                    </dt>
                    <dd className="text-sm font-medium text-foreground break-all">{data.email}</dd>
                  </div>
                </div>
              ) : null}
              {data.is_verified ? (
                <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                  <Shield className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Status
                    </dt>
                    <dd className="text-sm font-medium text-foreground">Verified neighbour</dd>
                  </div>
                </div>
              ) : null}
            </dl>

            {!data.phone && !data.email && !data.compound_name && !joinedLabel ? (
              <p className="text-sm text-muted-foreground">
                This neighbour keeps most profile details private.
              </p>
            ) : null}

            {data.is_own_profile ? (
              <p className="text-xs text-muted-foreground">
                You are previewing your public profile. Contact details always show to you here;
                neighbours only see what you enable under Settings → Public profile.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </PageLayout>
    </AppShell>
  )
}
