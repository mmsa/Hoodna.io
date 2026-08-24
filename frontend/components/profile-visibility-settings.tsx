"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ProfileVisibilitySchema,
  UserPreferencesSchema,
  type ProfileVisibility,
  type UserPreferences,
} from "@hoodna/shared"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"

const VISIBILITY_OPTIONS: Array<[keyof ProfileVisibility, string, string]> = [
  ["show_avatar", "Profile photo", "Show your photo on your public profile."],
  ["show_compound", "Neighbourhood", "Show which compound you belong to."],
  ["show_joined_at", "Member since", "Show when you joined eljiran."],
  ["show_phone", "Phone number", "Share your phone with neighbours who open your profile."],
  ["show_email", "Email address", "Share your email with neighbours who open your profile."],
]

const DEFAULT_VISIBILITY: ProfileVisibility = {
  show_avatar: true,
  show_compound: true,
  show_joined_at: true,
  show_phone: false,
  show_email: false,
}

export function ProfileVisibilitySettings() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const preferences = useQuery<UserPreferences>({
    queryKey: ["user-preferences"],
    queryFn: async () =>
      UserPreferencesSchema.parse((await api.get("/api/auth/me/preferences")).data),
  })

  const update = useMutation({
    mutationFn: async (profile_visibility: ProfileVisibility) =>
      (await api.patch("/api/auth/me/preferences", { profile_visibility })).data,
    onSuccess: (data) => {
      queryClient.setQueryData(["user-preferences"], data)
      toast({ title: "Profile privacy saved" })
    },
    onError: () => {
      toast({
        title: "Could not save",
        description: "Try again in a moment.",
        variant: "destructive",
      })
    },
  })

  const visibility = ProfileVisibilitySchema.parse(
    preferences.data?.profile_visibility ?? DEFAULT_VISIBILITY
  )

  return (
    <Card className="eljiran-card border-0">
      <CardHeader>
        <CardTitle>Public profile</CardTitle>
        <CardDescription>
          Choose what neighbours see when they open your profile from a post or listing. Your
          name is always visible.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {preferences.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading privacy settings…
          </p>
        ) : preferences.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load privacy settings.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {VISIBILITY_OPTIONS.map(([key, title, description]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <span>
                  <span className="block font-medium text-foreground">{title}</span>
                  <span className="text-sm text-muted-foreground">{description}</span>
                </span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={Boolean(visibility[key])}
                  disabled={update.isPending}
                  onChange={(event) =>
                    update.mutate({
                      ...visibility,
                      [key]: event.target.checked,
                    })
                  }
                />
              </label>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
