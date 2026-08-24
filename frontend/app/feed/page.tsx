"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowDown,
  Bell,
  Car,
  Home as HomeIcon,
  Loader2,
  MessageCircle,
  Package,
  Settings,
  ShoppingBag,
  Star,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AppShell,
  PageLayout,
  Section,
} from "@/components/ui/page-layout";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { useFeatureConfig } from "@/components/feature-config-provider";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/components/locale-provider";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { formatCompoundName, formatCompoundWithArea } from "@/lib/format-compound";
import { track } from "@/lib/telemetry";

import { PostCard } from "./components/post-card";
import { PostComposer } from "./components/post-composer";
import type { Listing, Post, FeedSummary } from "./components/types";
import { CommunitySidebar } from "@/components/community-sidebar";
import { CompoundHero } from "@/components/feed/compound-hero";

const getCategoryIcon = (category: string) => {
  switch (category.toUpperCase()) {
    case "PROPERTY":
      return <HomeIcon className="h-4 w-4 text-muted-foreground" />;
    case "CAR":
      return <Car className="h-4 w-4 text-muted-foreground" />;
    case "ITEM":
      return <Package className="h-4 w-4 text-muted-foreground" />;
    case "SERVICE":
      return <Wrench className="h-4 w-4 text-muted-foreground" />;
    default:
      return <ShoppingBag className="h-4 w-4 text-muted-foreground" />;
  }
};

export default function FeedPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user, isLoading: userLoading } = useAuth();
  const { isEnabled } = useFeatureConfig();
  const communityPostingEnabled = isEnabled("community_posting");
  const [newComments, setNewComments] = useState<Record<number, string>>({});
  const [isMounted, setIsMounted] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setIsMounted(true);
    if (/^#post-\d+$/.test(window.location.hash)) {
      setPostsLimit(1000);
    }
  }, []);

  const { data: moderatorProfile, isLoading: moderatorProfileLoading } = useQuery({
    queryKey: ["moderator-profile"],
    queryFn: async () => {
      const response = await api.get("/api/moderators/me");
      return response.data;
    },
    enabled: !!user && user.role === "COMPOUND_MOD",
    retry: false,
  });

  const isModerator = user?.role === "COMPOUND_MOD";
  const isStaff = user?.role === "ADMIN" || user?.role === "MODERATOR";
  const isModeratorProfileLoaded =
    !isModerator || moderatorProfile !== undefined;
  const isModeratorApproved =
    isModerator && moderatorProfile?.moderator_status === "APPROVED";
  const isResidentApproved = !isModerator && user?.status === "APPROVED";

  const effectiveCompoundId = isModerator
    ? moderatorProfile?.compound_id
    : user?.compound_id;

  const shouldFetchData = !!(
    user &&
    !userLoading &&
    isModeratorProfileLoaded &&
    effectiveCompoundId &&
    (isStaff || isModeratorApproved || (isResidentApproved && !isModerator))
  );

  const { data: feedSummary } = useQuery<FeedSummary>({
    queryKey: ["feed-summary", effectiveCompoundId],
    queryFn: async () => {
      const response = await api.get("/api/feed/summary");
      return response.data;
    },
    enabled: shouldFetchData && !moderatorProfileLoading,
    retry: false,
  });

  useQuery<Listing[]>({
    queryKey: ["recent-listings", effectiveCompoundId],
    queryFn: async () => {
      const response = await api.get("/api/listings?scope=compound&limit=20");
      return response.data;
    },
    enabled: shouldFetchData && !moderatorProfileLoading,
    retry: false,
  });

  const { data: latestForSale } = useQuery<Listing[]>({
    queryKey: ["latest-for-sale", effectiveCompoundId],
    queryFn: async () => {
      const response = await api.get(
        "/api/listings?scope=compound&intent=SELL&limit=10"
      );
      return response.data;
    },
    enabled: shouldFetchData && !moderatorProfileLoading,
    retry: false,
  });

  const { data: latestForRent } = useQuery<Listing[]>({
    queryKey: ["latest-for-rent", effectiveCompoundId],
    queryFn: async () => {
      const response = await api.get(
        "/api/listings?scope=compound&intent=RENT&limit=10"
      );
      return response.data;
    },
    enabled: shouldFetchData && !moderatorProfileLoading,
    retry: false,
  });

  const { data: latestServices } = useQuery<Listing[]>({
    queryKey: ["latest-services", effectiveCompoundId],
    queryFn: async () => {
      const response = await api.get(
        "/api/listings?scope=compound&category=SERVICE&limit=10"
      );
      return response.data;
    },
    enabled: shouldFetchData && !moderatorProfileLoading,
    retry: false,
  });

  const { data: featuredItems } = useQuery<Listing[]>({
    queryKey: ["featured-items"],
    queryFn: async () => {
      try {
        const crossResponse = await api.get("/api/listings?scope=cross&limit=6");
        if (crossResponse.data && crossResponse.data.length > 0) {
          return crossResponse.data;
        }
        const publicResponse = await api.get(
          "/api/listings?scope=public&limit=6"
        );
        return publicResponse.data || [];
      } catch {
        return [];
      }
    },
    enabled: shouldFetchData,
    retry: false,
  });

  const { data: announcements } = useQuery<Post[]>({
    queryKey: ["announcements", effectiveCompoundId],
    queryFn: async () => {
      const response = await api.get("/api/feed/announcements?limit=5");
      return response.data;
    },
    enabled: shouldFetchData,
    retry: false,
  });

  const { data: userStats } = useQuery<{
    posts_count: number;
    listings_count: number;
    saved_listings_count: number;
  }>({
    queryKey: ["user-stats", effectiveCompoundId],
    queryFn: async () => {
      try {
        const postsResponse = await api.get("/api/feed?limit=1000");
        const userPosts = (postsResponse.data || []).filter(
          (p: Post) => p.author_name === user?.name
        );

        const listingsResponse = await api.get(
          "/api/listings?scope=compound&limit=1000"
        );
        const userListings = (listingsResponse.data || []).filter(
          (l: Listing) => l.owner_name === user?.name
        );

        const savedResponse = await api.get("/api/saved-listings");
        const savedListings = savedResponse.data || [];

        return {
          posts_count: userPosts.length,
          listings_count: userListings.length,
          saved_listings_count: savedListings.length,
        };
      } catch {
        return {
          posts_count: 0,
          listings_count: 0,
          saved_listings_count: 0,
        };
      }
    },
    enabled: shouldFetchData,
    retry: false,
  });

  const [postsLimit, setPostsLimit] = useState(15);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);

  const {
    data: postsData,
    isLoading,
    error,
  } = useQuery<Post[]>({
    queryKey: ["feed", effectiveCompoundId, postsLimit],
    queryFn: async () => {
      const response = await api.get(`/api/feed?limit=${postsLimit}`);
      return response.data;
    },
    enabled: shouldFetchData && !moderatorProfileLoading,
    retry: false,
  });

  useEffect(() => {
    if (postsData) {
      setAllPosts(postsData);
      setHasMorePosts(postsData.length >= postsLimit);
    }
  }, [postsData, postsLimit]);

  useEffect(() => {
    if (!isMounted || isLoading || !/^#post-\d+$/.test(window.location.hash))
      return;

    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(window.location.hash.slice(1));
      if (!target) return;

      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [allPosts, announcements, isLoading, isMounted]);

  useEffect(() => {
    if (error) {
      const errorResponse = (error as { response?: { status?: number; data?: { detail?: string } } }).response;
      const errorDetail = errorResponse?.data?.detail || "";

      if (errorResponse?.status === 400 && errorDetail.includes("compound")) {
        router.push("/onboarding/compound-select");
        return;
      }

      if (
        effectiveCompoundId &&
        errorResponse?.status === 403 &&
        (errorDetail.includes("verified") || errorDetail.includes("approved"))
      ) {
        if (user?.role === "ADMIN" || user?.role === "MODERATOR") {
          return;
        }
        if (isModerator) {
          router.push("/moderator/status");
          return;
        }

        queryClient.invalidateQueries({ queryKey: ["current-user"] });
        setTimeout(async () => {
          try {
            const statusResponse = await api.get("/api/verification/status");
            if (statusResponse.data.user_status === "APPROVED") {
              queryClient.invalidateQueries({ queryKey: ["current-user"] });
              queryClient.invalidateQueries({ queryKey: ["feed"] });
              queryClient.invalidateQueries({ queryKey: ["feed-summary"] });
            } else {
              router.push("/verification");
            }
          } catch {
            router.push("/verification");
          }
        }, 500);
      }
    }
  }, [error, user, router, queryClient, isModerator, effectiveCompoundId]);

  const createPostMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      category?: string;
      is_urgent?: boolean;
    }) => {
      const response = await api.post("/api/posts", {
        content: data.content,
        category: data.category ?? "GENERAL",
        is_urgent: data.is_urgent ?? false,
      });
      return response.data;
    },
    onSuccess: (createdPost) => {
      track("post_created", {
        post_id: createdPost?.id,
        category: createdPost?.category,
        community_id: createdPost?.compound_id,
        source_screen: "feed",
      });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["feed-summary"] });
      toast({
        title: t("feed.postCreated"),
        description: t("feed.postCreatedDesc"),
        variant: "success",
      });
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast({
        title: t("feed.postFailed"),
        description: error?.response?.data?.detail || t("common.retry"),
        variant: "destructive",
      });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({
      postId,
      content,
    }: {
      postId: number;
      content: string;
    }) => {
      const response = await api.post(`/api/posts/${postId}/comments`, {
        content,
      });
      return response.data;
    },
    onSuccess: (createdComment) => {
      track("comment_created", {
        comment_id: createdComment?.id,
        post_id: createdComment?.post_id,
        source_screen: "feed",
      });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast({
        title: t("feed.commentFailed"),
        description: error?.response?.data?.detail || t("common.retry"),
        variant: "destructive",
      });
    },
  });

  const handleCreateComment = (postId: number) => {
    const content = newComments[postId];
    if (content?.trim()) {
      createCommentMutation.mutate({ postId, content });
      setNewComments({ ...newComments, [postId]: "" });
    }
  };

  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMorePosts) return;

    setIsLoadingMore(true);
    try {
      const newLimit = postsLimit + 15;
      const response = await api.get(`/api/feed?limit=${newLimit}`);
      setAllPosts(response.data);
      setPostsLimit(newLimit);
      setHasMorePosts(response.data.length >= newLimit);
    } catch {
      toast({
        title: t("feed.couldNotLoadMore"),
        description: t("common.retry"),
        variant: "destructive",
      });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const posts = allPosts;
  const urgentPosts = posts?.filter((p) => p.is_urgent === true) || [];
  const regularPosts =
    posts?.filter(
      (p) => !p.is_urgent && !announcements?.some((a) => a.id === p.id)
    ) || [];

  if (!userLoading && user && user.role === "SERVICE_PROVIDER") {
    return (
      <AppShell>
        <PageLayout width="sm" className="flex min-h-[calc(100vh-4rem)] items-center">
          <EmptyState
            title={t("feed.accessRestricted")}
            description={t("feed.providerNoFeed")}
            action={
              <Link href="/services">
                <Button>{t("marketplace.goToServices")}</Button>
              </Link>
            }
          />
        </PageLayout>
      </AppShell>
    );
  }

  if (userLoading || !user || (isModerator && moderatorProfileLoading)) {
    return (
      <AppShell>
        <PageLayout className="flex min-h-[calc(100vh-4rem)] items-center">
          <LoadingState title={t("common.loading")} className="w-full border-none bg-transparent" />
        </PageLayout>
      </AppShell>
    );
  }

  if (user) {
    if (!effectiveCompoundId) {
      return (
        <AppShell>
          <PageLayout className="flex min-h-[calc(100vh-4rem)] items-center">
            <LoadingState
              title={t("feed.redirecting")}
              description={t("feed.redirectingCompound")}
              className="w-full border-none bg-transparent"
            />
          </PageLayout>
        </AppShell>
      );
    }

    if (effectiveCompoundId && !isModeratorApproved && !isResidentApproved) {
      return (
        <AppShell>
          <PageLayout className="flex min-h-[calc(100vh-4rem)] items-center">
            <LoadingState
              title={t("feed.redirecting")}
              description={
                isModerator
                  ? t("feed.redirectingModerator")
                  : t("feed.redirectingVerification")
              }
              className="w-full border-none bg-transparent"
            />
          </PageLayout>
        </AppShell>
      );
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <PageLayout className="flex min-h-[calc(100vh-4rem)] items-center">
          <LoadingState title={t("feed.loadingFeed")} className="w-full border-none bg-transparent" />
        </PageLayout>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageLayout width="full" className="py-0">
        <div className="flex gap-6 xl:gap-8">
          <div className="min-w-0 flex-1">
            {user && feedSummary?.compound_name && (
              <CompoundHero
                compoundName={feedSummary.compound_name}
                compoundArea={feedSummary.compound_area}
                heroImageUrl={feedSummary.compound_hero_image_url}
                totalNeighbors={feedSummary.total_neighbors}
                recentPostsCount={feedSummary.recent_posts_count}
                recentListingsCount={feedSummary.recent_listings_count}
              />
            )}

            {user && feedSummary && (
              <div className="mb-6 xl:hidden">
                <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">
                  {user.name}
                </h1>
                <p className="text-base text-muted-foreground">
                  {formatCompoundWithArea(
                    feedSummary.compound_name,
                    feedSummary.compound_area
                  )}
                </p>
              </div>
            )}

            {isModerator && isModeratorApproved && (
              <Card className="mb-6 border-border shadow-none">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Moderation Dashboard
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Manage content and reports for{" "}
                      {moderatorProfile?.compound_name || "your compound"}
                    </p>
                  </div>
                  <Link href="/moderator/dashboard">
                    <Button variant="outline">
                      <Settings className="mr-2 h-4 w-4" />
                      Open Dashboard
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {communityPostingEnabled ? (
              <div className="mb-6">
                <PostComposer
                  userName={user.name}
                  userAvatarUrl={user.avatar_url}
                  isSubmitting={createPostMutation.isPending}
                  onSubmit={(post) => createPostMutation.mutate(post)}
                />
              </div>
            ) : (
              <Card className="mb-6 border-border shadow-none">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Community posting is temporarily unavailable.
                </CardContent>
              </Card>
            )}

            {urgentPosts.length > 0 && (
              <Section
                className="mb-8"
                title={t("feed.urgentAlerts")}
                description={t("feed.urgentAlertsDesc")}
                surface
              >
                <div className="space-y-5">
                  {urgentPosts.map((alert) => (
                    <PostCard
                      key={alert.id}
                      post={alert}
                      newComments={newComments}
                      setNewComments={setNewComments}
                      handleCreateComment={handleCreateComment}
                      createCommentMutation={createCommentMutation}
                      currentUser={user}
                    />
                  ))}
                </div>
              </Section>
            )}

            <Section
              className="mb-8"
              title={
                feedSummary?.compound_name
                  ? `${formatCompoundName(feedSummary.compound_name)} official announcement${announcements?.length !== 1 ? "s" : ""}`
                  : t("feed.neighbourhoodAnnouncements")
              }
              description={t("feed.neighbourhoodAnnouncementsDesc")}
            >
              {announcements && announcements.length > 0 ? (
                <div className="space-y-5">
                  {announcements.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      newComments={newComments}
                      setNewComments={setNewComments}
                      handleCreateComment={handleCreateComment}
                      createCommentMutation={createCommentMutation}
                      currentUser={user}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Bell className="h-5 w-5" />}
                  title={t("feed.noAnnouncements")}
                  description={t("feed.noAnnouncementsDesc")}
                />
              )}
            </Section>

            {regularPosts.length > 0 && (
              <Section
                className="mb-8"
                title={t("feed.communityDiscussions")}
                description={t("feed.communityDiscussionsDesc")}
              >
                <div className="space-y-5">
                  {regularPosts.map((post) => {
                    const isRecent =
                      isMounted &&
                      (() => {
                        const postDate = new Date(post.created_at);
                        const now = new Date();
                        return (
                          (now.getTime() - postDate.getTime()) / 3600000 < 1
                        );
                      })();
                    const hasManyComments =
                      post.comments && post.comments.length >= 5;

                    return (
                      <div key={post.id}>
                        {isRecent && (
                          <p className="mb-2 text-xs font-medium text-primary">
                            Just posted
                          </p>
                        )}
                        {hasManyComments && !isRecent && (
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            Active discussion · {post.comments.length} comments
                          </p>
                        )}
                        <PostCard
                          post={post}
                          newComments={newComments}
                          setNewComments={setNewComments}
                          handleCreateComment={handleCreateComment}
                          createCommentMutation={createCommentMutation}
                          currentUser={user}
                        />
                      </div>
                    );
                  })}

                  {hasMorePosts && (
                    <div className="flex justify-center pt-4">
                      <Button
                        onClick={loadMorePosts}
                        disabled={isLoadingMore}
                        variant="outline"
                      >
                        {isLoadingMore ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading…
                          </>
                        ) : (
                          <>
                            Load more posts
                            <ArrowDown className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {!hasMorePosts && posts.length > 15 && (
                    <p className="pt-4 text-center text-sm text-muted-foreground">
                      You&apos;ve reached the end.
                    </p>
                  )}
                </div>
              </Section>
            )}

            {featuredItems && featuredItems.length > 0 && (
              <Section
                className="mb-8"
                title={t("feed.featuredItems")}
                actions={
                  <Link href="/marketplace?scope=cross">
                    <Button variant="ghost" size="sm">
                      View all
                    </Button>
                  </Link>
                }
              >
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {featuredItems.slice(0, 4).map((listing) => (
                    <Link key={listing.id} href={`/marketplace/${listing.id}`}>
                      <Card className="cursor-pointer border-border shadow-none transition-colors hover:bg-muted/30">
                        {listing.image_urls && listing.image_urls.length > 0 ? (
                          <img
                            src={listing.image_urls[0]}
                            alt={listing.title}
                            className="h-32 w-full rounded-t-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-32 w-full items-center justify-center rounded-t-lg bg-muted">
                            {getCategoryIcon(listing.category)}
                          </div>
                        )}
                        <CardContent className="p-2.5">
                          <div className="mb-1 flex items-start justify-between gap-1">
                            <h4 className="line-clamp-2 text-xs font-medium text-foreground">
                              {listing.title}
                            </h4>
                            <Star className="h-3.5 w-3.5 shrink-0 text-primary" />
                          </div>
                          <p className="text-xs font-semibold text-foreground">
                            {listing.currency} {listing.price}
                          </p>
                          {listing.compound_name && (
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {formatCompoundName(listing.compound_name)}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </Section>
            )}

            {((latestForSale && latestForSale.length > 0) ||
              (latestForRent && latestForRent.length > 0) ||
              (latestServices && latestServices.length > 0)) && (
              <Section
                className="mb-8"
                title={t("feed.latestMarketplace")}
                actions={
                  <Link href="/marketplace">
                    <Button variant="ghost" size="sm">
                      View all
                    </Button>
                  </Link>
                }
              >
                {latestForSale && latestForSale.length > 0 && (
                  <div className="mb-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-foreground">
                        For sale
                      </h3>
                      <Link href="/marketplace?intent=SELL">
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          View all
                        </Button>
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {latestForSale.slice(0, 4).map((listing) => (
                        <Link
                          key={listing.id}
                          href={`/marketplace/${listing.id}`}
                        >
                          <Card className="cursor-pointer border-border shadow-none transition-colors hover:bg-muted/30">
                            {listing.image_urls &&
                            listing.image_urls.length > 0 ? (
                              <img
                                src={listing.image_urls[0]}
                                alt={listing.title}
                                className="h-28 w-full rounded-t-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-28 w-full items-center justify-center rounded-t-lg bg-muted">
                                {getCategoryIcon(listing.category)}
                              </div>
                            )}
                            <CardContent className="p-2.5">
                              <h4 className="mb-1 line-clamp-2 text-xs font-medium text-foreground">
                                {listing.title}
                              </h4>
                              <p className="text-xs font-semibold text-foreground">
                                {listing.currency} {listing.price}
                              </p>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {latestForRent && latestForRent.length > 0 && (
                  <div className="mb-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-foreground">
                        For rent
                      </h3>
                      <Link href="/marketplace?intent=RENT">
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          View all
                        </Button>
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {latestForRent.slice(0, 4).map((listing) => (
                        <Link
                          key={listing.id}
                          href={`/marketplace/${listing.id}`}
                        >
                          <Card className="cursor-pointer border-border shadow-none transition-colors hover:bg-muted/30">
                            {listing.image_urls &&
                            listing.image_urls.length > 0 ? (
                              <img
                                src={listing.image_urls[0]}
                                alt={listing.title}
                                className="h-28 w-full rounded-t-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-28 w-full items-center justify-center rounded-t-lg bg-muted">
                                <HomeIcon className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <CardContent className="p-2.5">
                              <h4 className="mb-1 line-clamp-2 text-xs font-medium text-foreground">
                                {listing.title}
                              </h4>
                              <p className="text-xs font-semibold text-foreground">
                                {listing.currency} {listing.price}
                              </p>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {latestServices && latestServices.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-foreground">
                        Services
                      </h3>
                      <Link href="/marketplace?category=SERVICE">
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          View all
                        </Button>
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {latestServices.slice(0, 4).map((listing) => (
                        <Link
                          key={listing.id}
                          href={`/marketplace/${listing.id}`}
                        >
                          <Card className="cursor-pointer border-border shadow-none transition-colors hover:bg-muted/30">
                            {listing.image_urls &&
                            listing.image_urls.length > 0 ? (
                              <img
                                src={listing.image_urls[0]}
                                alt={listing.title}
                                className="h-28 w-full rounded-t-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-28 w-full items-center justify-center rounded-t-lg bg-muted">
                                <Wrench className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <CardContent className="p-2.5">
                              <h4 className="mb-1 line-clamp-2 text-xs font-medium text-foreground">
                                {listing.title}
                              </h4>
                              {listing.price ? (
                                <p className="text-xs font-semibold text-foreground">
                                  {listing.currency} {listing.price}
                                </p>
                              ) : null}
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            )}

            {posts && posts.length === 0 && (
              <EmptyState
                icon={<MessageCircle className="h-5 w-5" />}
                title={t("feed.emptyPosts")}
                description={t("feed.noPostsDesc")}
              />
            )}
          </div>

          <aside className="hidden w-72 shrink-0 xl:block">
            <CommunitySidebar
              totalNeighbors={feedSummary?.total_neighbors}
              recentPosts={feedSummary?.recent_posts_count}
              recentListings={feedSummary?.recent_listings_count}
              posts={posts}
            />
          </aside>
        </div>
      </PageLayout>
    </AppShell>
  );
}
