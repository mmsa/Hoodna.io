"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import {
  Send,
  MessageCircle,
  Heart,
  Share2,
  ShoppingBag,
  Bell,
  Calendar,
  Tag,
  DollarSign,
  Package,
  Car,
  Home as HomeIcon,
  Home,
  CheckCircle,
  Wrench,
  Plus,
  ArrowRight,
  Tv,
  Gamepad2,
  Star,
  User,
  Users,
  MapPin,
  Building2,
  Settings,
  HelpCircle,
  Search,
  Clock,
  ThumbsUp,
  Smile,
  Loader2,
  ArrowDown,
  Trash2,
  Ban,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { formatCompoundName, formatCompoundWithArea } from "@/lib/format-compound";

interface Post {
  id: number;
  author_id: number;
  author_name: string;
  content: string;
  created_at: string;
  compound_id?: number;
  comments: Comment[];
}

interface Comment {
  id: number;
  author_name: string;
  content: string;
  created_at: string;
}

interface Listing {
  id: number;
  title: string;
  category: string;
  price: number;
  currency: string;
  intent: string;
  image_urls: string[];
  compound_name: string;
  owner_name: string;
  created_at: string;
  description?: string;
}

interface FeedSummary {
  compound_name: string | null;
  compound_area: string | null;
  compound_developer: string | null;
  compound_status: string | null;
  recent_listings_count: number;
  recent_posts_count: number;
  total_neighbors: number;
}

const getCategoryIcon = (category: string) => {
  switch (category.toUpperCase()) {
    case "PROPERTY":
      return <HomeIcon className="w-4 h-4" />;
    case "CAR":
      return <Car className="w-4 h-4" />;
    case "ITEM":
      return <Package className="w-4 h-4" />;
    case "SERVICE":
      return <Wrench className="w-4 h-4" />;
    default:
      return <ShoppingBag className="w-4 h-4" />;
  }
};

const getCategoryName = (category: string) => {
  switch (category.toUpperCase()) {
    case "CAR":
      return "Cars";
    case "ITEM":
      return "Items";
    case "PROPERTY":
      return "Property";
    case "SERVICE":
      return "Services";
    default:
      return category;
  }
};

// Time formatting utility - "2h ago" style
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Post type detection
const detectPostType = (
  content: string
): {
  type: "help" | "lost" | "event" | "marketplace" | "general";
  icon: any;
  color: string;
  badge: string;
} => {
  const lowerContent = content.toLowerCase();

  if (
    lowerContent.includes("lost") ||
    lowerContent.includes("found") ||
    lowerContent.includes("missing")
  ) {
    return {
      type: "lost",
      icon: Search,
      color: "pink",
      badge: "LOST & FOUND",
    };
  }

  if (
    lowerContent.includes("help") ||
    lowerContent.includes("need") ||
    lowerContent.includes("urgent") ||
    lowerContent.includes("plumber") ||
    lowerContent.includes("electrician")
  ) {
    return {
      type: "help",
      icon: HelpCircle,
      color: "amber",
      badge: "HELP REQUEST",
    };
  }

  if (
    lowerContent.includes("event") ||
    lowerContent.includes("gathering") ||
    lowerContent.includes("meeting") ||
    lowerContent.includes("weekend") ||
    lowerContent.includes("party")
  ) {
    return {
      type: "event",
      icon: Calendar,
      color: "indigo",
      badge: "COMMUNITY EVENT",
    };
  }

  if (
    lowerContent.includes("sell") ||
    lowerContent.includes("buy") ||
    lowerContent.includes("for sale") ||
    lowerContent.includes("for rent")
  ) {
    return {
      type: "marketplace",
      icon: ShoppingBag,
      color: "green",
      badge: "MARKETPLACE",
    };
  }

  return {
    type: "general",
    icon: MessageCircle,
    color: "gray",
    badge: "",
  };
};

export default function FeedPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: userLoading } = useAuth();
  const [newPost, setNewPost] = useState("");
  const [newComments, setNewComments] = useState<Record<number, string>>({});
  const [isMounted, setIsMounted] = useState(false);
  const queryClient = useQueryClient();

  // Prevent hydration mismatch by only rendering conditional content after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch moderator profile if user is COMPOUND_MOD
  const { data: moderatorProfile, isLoading: moderatorProfileLoading } = useQuery({
    queryKey: ['moderator-profile'],
    queryFn: async () => {
      const response = await api.get('/api/moderators/me')
      return response.data
    },
    enabled: !!user && user.role === 'COMPOUND_MOD',
    retry: false,
  })

  // Proactively check compound selection first, then verification
  // This must happen BEFORE any API calls to prevent wrong redirects
  const isModerator = user?.role === 'COMPOUND_MOD'
  const isModeratorProfileLoaded = !isModerator || moderatorProfile !== undefined
  const isModeratorApproved = isModerator && moderatorProfile?.moderator_status === 'APPROVED'
  const isResidentApproved = !isModerator && user?.status === 'APPROVED'
  
  // For moderators, use compound_id from their profile; for residents, use user.compound_id
  const effectiveCompoundId = isModerator ? moderatorProfile?.compound_id : user?.compound_id
  
  const shouldFetchData = !!(
    user &&
    !userLoading &&
    isModeratorProfileLoaded &&
    effectiveCompoundId &&
    (isModeratorApproved || (isResidentApproved && !isModerator))
  );

  // Fetch feed summary - only if compound is selected and user is verified
  const { data: feedSummary } = useQuery<FeedSummary>({
    queryKey: ["feed-summary"],
    queryFn: async () => {
      const response = await api.get("/api/feed/summary");
      return response.data;
    },
    enabled: shouldFetchData && !moderatorProfileLoading,
    retry: false,
  });

  // Fetch recent listings - only if compound is selected and user is verified
  const { data: recentListings } = useQuery<Listing[]>({
    queryKey: ["recent-listings"],
    queryFn: async () => {
      const response = await api.get("/api/listings?scope=compound&limit=20");
      return response.data;
    },
    enabled: shouldFetchData && !moderatorProfileLoading,
    retry: false,
  });

  // Fetch latest items for sale - only if compound is selected and user is verified
  const { data: latestForSale } = useQuery<Listing[]>({
    queryKey: ["latest-for-sale"],
    queryFn: async () => {
      const response = await api.get(
        "/api/listings?scope=compound&intent=SELL&limit=10"
      );
      return response.data;
    },
    enabled: shouldFetchData && !moderatorProfileLoading,
    retry: false,
  });

  // Fetch latest items for rent - only if compound is selected and user is verified
  const { data: latestForRent } = useQuery<Listing[]>({
    queryKey: ["latest-for-rent"],
    queryFn: async () => {
      const response = await api.get(
        "/api/listings?scope=compound&intent=RENT&limit=10"
      );
      return response.data;
    },
    enabled: shouldFetchData && !moderatorProfileLoading,
    retry: false,
  });

  // Fetch latest services - only if compound is selected and user is verified
  const { data: latestServices } = useQuery<Listing[]>({
    queryKey: ["latest-services"],
    queryFn: async () => {
      const response = await api.get(
        "/api/listings?scope=compound&category=SERVICE&limit=10"
      );
      return response.data;
    },
    enabled: shouldFetchData && !moderatorProfileLoading,
    retry: false,
  });

  // Fetch featured items (promoted listings - cross-compound and public)
  // Only if compound is selected and user is verified
  const { data: featuredItems } = useQuery<Listing[]>({
    queryKey: ["featured-items"],
    queryFn: async () => {
      try {
        // Try to get cross-compound promoted listings first
        const crossResponse = await api.get(
          "/api/listings?scope=cross&limit=6"
        );
        if (crossResponse.data && crossResponse.data.length > 0) {
          return crossResponse.data;
        }
        // Fallback to public promoted listings
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

  // Fetch compound announcements (from admins/moderators)
  // Only if compound is selected and user is verified
  const { data: announcements } = useQuery<Post[]>({
    queryKey: ["announcements"],
    queryFn: async () => {
      const response = await api.get("/api/feed/announcements?limit=5");
      return response.data;
    },
    enabled: shouldFetchData,
    retry: false,
  });

  // Fetch user's own stats - only if compound is selected and user is verified
  const { data: userStats } = useQuery<{
    posts_count: number;
    listings_count: number;
    saved_listings_count: number;
  }>({
    queryKey: ["user-stats"],
    queryFn: async () => {
      try {
        // Get user's posts
        const postsResponse = await api.get("/api/feed?limit=1000");
        const userPosts = (postsResponse.data || []).filter(
          (p: Post) => p.author_name === user?.name
        );

        // Get user's listings
        const listingsResponse = await api.get(
          "/api/listings?scope=compound&limit=1000"
        );
        const userListings = (listingsResponse.data || []).filter(
          (l: Listing) => l.owner_name === user?.name
        );

        // Get saved listings
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

  const [postsLimit, setPostsLimit] = useState(15); // Initial limit
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);

  const {
    data: postsData,
    isLoading,
    error,
  } = useQuery<Post[]>({
    queryKey: ["feed", postsLimit],
    queryFn: async () => {
      const response = await api.get(`/api/feed?limit=${postsLimit}`);
      return response.data;
    },
    enabled: shouldFetchData && !moderatorProfileLoading,
    retry: false,
  });

  // Update posts when data changes
  useEffect(() => {
    if (postsData) {
      setAllPosts(postsData);
      // If we got fewer posts than requested, there are no more
      setHasMorePosts(postsData.length >= postsLimit);
    }
  }, [postsData, postsLimit]);

  // Redirect based on error type (fallback for API errors)
  // Note: Compound check happens first in the useEffect above
  useEffect(() => {
    if (error) {
      const errorResponse = (error as any).response;
      const errorDetail = errorResponse?.data?.detail || "";

      // Check compound first (400 error)
      if (errorResponse?.status === 400 && errorDetail.includes("compound")) {
        router.push("/onboarding/compound-select");
        return;
      }

      // Only check verification if compound is already selected
      // (to avoid redirecting to verification when compound is missing)
      if (
        effectiveCompoundId &&
        errorResponse?.status === 403 &&
        (errorDetail.includes("verified") || errorDetail.includes("approved"))
      ) {
        // For moderators, redirect to moderator status page
        if (isModerator) {
          router.push("/moderator/status");
          return;
        }
        
        // For residents, refresh user data first in case status was just updated
        queryClient.invalidateQueries({ queryKey: ['current-user'] });
        // Small delay to allow user data to refresh, then check verification status
        setTimeout(async () => {
          try {
            const statusResponse = await api.get('/api/verification/status');
            // If verification status shows user is now approved, refresh and stay on page
            if (statusResponse.data.user_status === 'APPROVED') {
              queryClient.invalidateQueries({ queryKey: ['current-user'] });
              queryClient.invalidateQueries({ queryKey: ['feed'] });
              queryClient.invalidateQueries({ queryKey: ['feed-summary'] });
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
    mutationFn: async (data: { content: string; category?: string; is_urgent?: boolean } | string) => {
      // Handle both old format (string) and new format (object)
      const postData = typeof data === 'string' 
        ? { content: data, category: "GENERAL", is_urgent: false }
        : data;
      const response = await api.post("/api/posts", postData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["feed-summary"] });
      setNewPost("");
      toast({
        title: "Post created! 🎉",
        description: "Your post has been shared with the community.",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create post",
        description: error?.response?.data?.detail || "Please try again.",
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add comment",
        description: error?.response?.data?.detail || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreatePost = () => {
    if (newPost.trim()) {
      createPostMutation.mutate(newPost);
    }
  };

  const handleCreateComment = (postId: number) => {
    const content = newComments[postId];
    if (content?.trim()) {
      createCommentMutation.mutate({ postId, content });
      setNewComments({ ...newComments, [postId]: "" });
    }
  };

  // Group listings by category for "For Sale" section
  const groupedListings =
    latestForSale?.reduce((acc, listing) => {
      const category = listing.category.toUpperCase();
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(listing);
      return acc;
    }, {} as Record<string, Listing[]>) || {};

  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMorePosts) return;

    setIsLoadingMore(true);
    try {
      const newLimit = postsLimit + 15;
      const response = await api.get(`/api/feed?limit=${newLimit}`);
      setAllPosts(response.data);
      setPostsLimit(newLimit);
      setHasMorePosts(response.data.length >= newLimit);
    } catch (error) {
      console.error("Failed to load more posts:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const posts = allPosts;

  // Block SERVICE_PROVIDER users from accessing the feed
  if (!userLoading && user && user.role === "SERVICE_PROVIDER") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-32 h-32 mx-auto mb-8 bg-orange-100 rounded-full flex items-center justify-center">
            <span className="text-6xl">🚫</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Access Restricted
          </h1>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            Service providers are not allowed to browse the feed. Please manage your services from the Services page.
          </p>
          <Link href="/services">
            <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              Go to My Services
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Show loading while user data or moderator profile is being fetched
  if (userLoading || !user || (isModerator && moderatorProfileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Early return: Don't render anything if user doesn't meet requirements
  // This prevents any API calls from being made
  if (user) {
    // For moderators, check moderator profile; for residents, check user.compound_id
    if (!effectiveCompoundId) {
      // Redirect will happen in useEffect, but return early to prevent rendering
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">
              Redirecting to neighbourhood selection...
            </p>
          </div>
        </div>
      );
    }
    
    // For moderators, check moderator_status; for residents, check user.status
    if (effectiveCompoundId && !isModeratorApproved && !isResidentApproved) {
      // Redirect will happen in useEffect, but return early to prevent rendering
      if (isModerator) {
        // Moderator not approved - redirect to moderator status page
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Redirecting to moderator status...</p>
            </div>
          </div>
        );
      } else {
        // Resident not approved - redirect to verification
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Redirecting to verification...</p>
            </div>
          </div>
        );
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Responsive layout - wider feed on desktop */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar - Profile (hidden on mobile, visible on large screens) */}
          <aside className="hidden lg:block w-80 flex-shrink-0">
            <ProfileSidebar
              user={user}
              feedSummary={feedSummary}
              userStats={userStats}
            />
          </aside>

          {/* Main Content - Feed (wider, more comfortable) */}
          <div className="flex-1 min-w-0 lg:max-w-3xl">
            {/* Header - User Name and Location (Mobile) */}
            {user && feedSummary && (
              <div className="mb-6 lg:hidden">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  {user.name}
                </h1>
                <p className="text-gray-600 text-sm">
                  {formatCompoundWithArea(feedSummary.compound_name, feedSummary.compound_area)}
                </p>
              </div>
            )}

            {/* Moderator Dashboard Link - Only for approved moderators */}
            {isModerator && isModeratorApproved && (
              <Card className="mb-6 border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                        <Settings className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Moderation Dashboard</h3>
                        <p className="text-sm text-gray-600">Manage content and reports for {moderatorProfile?.compound_name || 'your compound'}</p>
                      </div>
                    </div>
                    <Link href="/moderator/dashboard">
                      <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                        <Settings className="w-4 h-4 mr-2" />
                        Open Dashboard
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Create Post Input - At the top */}
            <Card className="mb-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-xl bg-white">
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="What's on your mind?"
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleCreatePost()}
                    className="flex-1 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-200"
                  />
                  <Button
                    onClick={handleCreatePost}
                    disabled={createPostMutation.isPending || !newPost.trim()}
                    className="bg-purple-600 hover:bg-purple-700 rounded-lg"
                  >
                    {createPostMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ALERTS SECTION - Urgent Posts */}
            {(() => {
              const urgentPosts = posts?.filter((p) => p.is_urgent === true) || [];
              if (urgentPosts.length === 0) return null;
              
              return (
                <div className="mb-8">
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
                        <Bell className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-red-900">
                          ⚠️ Urgent Alerts
                        </h2>
                        <p className="text-xs text-red-700">
                          Time-sensitive updates requiring immediate attention
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
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
                  </div>
                </div>
              );
            })()}

            {/* Compound Announcements Section - Moderator Only (Always visible) */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-sm">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {feedSummary?.compound_name ? `${formatCompoundName(feedSummary.compound_name)} Official Announcement${announcements?.length !== 1 ? 's' : ''}` : 'Neighbourhood Announcements'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Official updates from neighbourhood management
                  </p>
                </div>
              </div>

              {announcements && announcements.length > 0 ? (
                <div className="space-y-4">
                  {announcements.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      newComments={newComments}
                      setNewComments={setNewComments}
                      handleCreateComment={handleCreateComment}
                      createCommentMutation={createCommentMutation}
                    />
                  ))}
                </div>
              ) : (
                <Card className="border border-gray-200 rounded-xl bg-gradient-to-br from-yellow-50 to-amber-50/30">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-3">
                      <Bell className="w-8 h-8 text-yellow-500" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                      No announcements
                    </h3>
                    <p className="text-sm text-gray-600">
                      Check back later for updates from neighbourhood management
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Community Discussions Section */}
            {(() => {
              const regularPosts = posts?.filter((p) => !p.is_urgent && !announcements?.some((a) => a.id === p.id)) || [];
              if (regularPosts.length === 0) return null;
              
              return (
                <div className="mb-8" key="discussions">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center shadow-sm">
                        <MessageCircle className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">
                          Community Discussions
                        </h2>
                        <p className="text-xs text-gray-600">
                          Posts from your neighbors, organized by category
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {regularPosts.map((post) => {
                      // Highlight recent posts (within last hour) and posts with many comments
                      const isRecent = (() => {
                        const postDate = new Date(post.created_at);
                        const now = new Date();
                        const diffHours =
                          (now.getTime() - postDate.getTime()) / 3600000;
                        return diffHours < 1;
                      })();
                      const hasManyComments =
                        post.comments && post.comments.length >= 5;
                      const isHighlighted = isRecent || hasManyComments;

                      return (
                        <div
                          key={post.id}
                          className={`transition-all ${
                            isHighlighted
                              ? "ring-2 ring-purple-300 ring-offset-2 rounded-xl p-1"
                              : ""
                          }`}
                        >
                          {isMounted && isRecent && (
                            <div className="mb-2 flex items-center gap-2">
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                Just now
                              </span>
                            </div>
                          )}
                          {isMounted && hasManyComments && !isRecent && (
                            <div className="mb-2 flex items-center gap-2">
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full flex items-center gap-1">
                                <MessageCircle className="w-3 h-3" />
                                Hot discussion ({post.comments.length} comments)
                              </span>
                            </div>
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

                    {/* Load More Button */}
                    {hasMorePosts && (
                      <div className="flex justify-center pt-4">
                        <Button
                          onClick={loadMorePosts}
                          disabled={isLoadingMore}
                          variant="outline"
                          className="border-2 border-purple-300 text-purple-700 hover:bg-purple-50"
                        >
                          {isLoadingMore ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              Load More Posts
                              <ArrowDown className="w-4 h-4 ml-2" />
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {!hasMorePosts && posts.length > 15 && (
                      <div className="text-center pt-4">
                        <p className="text-sm text-gray-500">
                          You've reached the end! 🎉
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Featured Items Section */}
            {featuredItems && featuredItems.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    Featured Items
                  </h2>
                  <Link href="/marketplace?scope=cross">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-purple-600"
                    >
                      View all →
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {featuredItems.slice(0, 4).map((listing) => (
                    <Link key={listing.id} href={`/marketplace/${listing.id}`}>
                      <Card className="hover:shadow-lg transition-all cursor-pointer border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-white relative">
                        <div className="absolute top-2 right-2 z-10">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        </div>
                        {listing.image_urls && listing.image_urls.length > 0 ? (
                          <img
                            src={listing.image_urls[0]}
                            alt={listing.title}
                            className="w-full h-32 object-cover rounded-t-lg"
                          />
                        ) : (
                          <div className="w-full h-32 bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-t-lg flex items-center justify-center">
                            {getCategoryIcon(listing.category)}
                          </div>
                        )}
                        <CardContent className="p-2.5">
                          <h4 className="font-medium text-xs line-clamp-2 mb-1 text-gray-900">
                            {listing.title}
                          </h4>
                          <p className="text-xs font-semibold text-purple-600">
                            {listing.currency} {listing.price}
                          </p>
                          {listing.compound_name && (
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              {formatCompoundName(listing.compound_name)}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Latest Marketplace Section */}
            {((latestForSale && latestForSale.length > 0) ||
              (latestForRent && latestForRent.length > 0) ||
              (latestServices && latestServices.length > 0)) && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-purple-600" />
                    Latest Marketplace
                  </h2>
                  <Link href="/marketplace">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-purple-600"
                    >
                      View all →
                    </Button>
                  </Link>
                </div>

                {/* For Sale */}
                {latestForSale && latestForSale.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-800 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-purple-600" />
                        For Sale
                      </h3>
                      <Link href="/marketplace?intent=SELL">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-purple-600 h-7 text-xs"
                        >
                          View all →
                        </Button>
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {latestForSale.slice(0, 4).map((listing) => (
                        <Link
                          key={listing.id}
                          href={`/marketplace/${listing.id}`}
                        >
                          <Card className="hover:shadow-md transition-shadow cursor-pointer border border-gray-200">
                            {listing.image_urls &&
                            listing.image_urls.length > 0 ? (
                              <img
                                src={listing.image_urls[0]}
                                alt={listing.title}
                                className="w-full h-28 object-cover rounded-t-lg"
                              />
                            ) : (
                              <div className="w-full h-28 bg-gray-100 rounded-t-lg flex items-center justify-center">
                                {getCategoryIcon(listing.category)}
                              </div>
                            )}
                            <CardContent className="p-2.5">
                              <h4 className="font-medium text-xs line-clamp-2 mb-1 text-gray-900">
                                {listing.title}
                              </h4>
                              <p className="text-xs font-semibold text-purple-600">
                                {listing.currency} {listing.price}
                              </p>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* For Rent */}
                {latestForRent && latestForRent.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-800 flex items-center gap-2">
                        <HomeIcon className="w-4 h-4 text-blue-600" />
                        For Rent
                      </h3>
                      <Link href="/marketplace?intent=RENT">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-purple-600 h-7 text-xs"
                        >
                          View all →
                        </Button>
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {latestForRent.slice(0, 4).map((listing) => (
                        <Link
                          key={listing.id}
                          href={`/marketplace/${listing.id}`}
                        >
                          <Card className="hover:shadow-md transition-shadow cursor-pointer border border-gray-200">
                            {listing.image_urls &&
                            listing.image_urls.length > 0 ? (
                              <img
                                src={listing.image_urls[0]}
                                alt={listing.title}
                                className="w-full h-28 object-cover rounded-t-lg"
                              />
                            ) : (
                              <div className="w-full h-28 bg-gray-100 rounded-t-lg flex items-center justify-center">
                                <HomeIcon className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                            <CardContent className="p-2.5">
                              <h4 className="font-medium text-xs line-clamp-2 mb-1 text-gray-900">
                                {listing.title}
                              </h4>
                              <p className="text-xs font-semibold text-blue-600">
                                {listing.currency} {listing.price}
                              </p>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Services */}
                {latestServices && latestServices.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-800 flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-purple-600" />
                        Services
                      </h3>
                      <Link href="/marketplace?category=SERVICE">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-purple-600 h-7 text-xs"
                        >
                          View all →
                        </Button>
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {latestServices.slice(0, 4).map((listing) => (
                        <Link
                          key={listing.id}
                          href={`/marketplace/${listing.id}`}
                        >
                          <Card className="hover:shadow-md transition-shadow cursor-pointer border border-gray-200">
                            {listing.image_urls &&
                            listing.image_urls.length > 0 ? (
                              <img
                                src={listing.image_urls[0]}
                                alt={listing.title}
                                className="w-full h-28 object-cover rounded-t-lg"
                              />
                            ) : (
                              <div className="w-full h-28 bg-gray-100 rounded-t-lg flex items-center justify-center">
                                <Wrench className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                            <CardContent className="p-2.5">
                              <h4 className="font-medium text-xs line-clamp-2 mb-1 text-gray-900">
                                {listing.title}
                              </h4>
                              {listing.price && (
                                <p className="text-xs font-semibold text-purple-600">
                                  {listing.currency} {listing.price}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {posts && posts.length === 0 && (
              <Card className="border border-gray-200">
                <CardContent className="p-12 text-center">
                  <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    No posts yet
                  </h3>
                  <p className="text-gray-500">
                    Be the first to share something with your community!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Profile Sidebar Component
function ProfileSidebar({
  user,
  feedSummary,
  userStats,
}: {
  user: any;
  feedSummary: FeedSummary | undefined;
  userStats:
    | {
        posts_count: number;
        listings_count: number;
        saved_listings_count: number;
      }
    | undefined;
}) {
  if (!user) return null;

  return (
    <div className="space-y-4 sticky top-6">
      {/* Profile Card */}
      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          {/* Avatar and Name */}
          <div className="flex flex-col items-center mb-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center mb-3 shadow-lg">
              <span className="text-white text-2xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {user.name}
            </h3>
            {user.status === "APPROVED" && (
              <div className="flex items-center gap-1 text-xs text-green-600 mb-2">
                <CheckCircle className="w-3 h-3" />
                <span>Verified</span>
              </div>
            )}
            {user.role === "ADMIN" || user.role === "MODERATOR" ? (
              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                {user.role}
              </span>
            ) : null}
          </div>

          {/* Stats */}
          {userStats && (
            <div className="grid grid-cols-3 gap-3 mb-4 pt-4 border-t border-gray-200">
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">
                  {userStats.posts_count}
                </div>
                <div className="text-xs text-gray-500">Posts</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">
                  {userStats.listings_count}
                </div>
                <div className="text-xs text-gray-500">Listings</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">
                  {userStats.saved_listings_count}
                </div>
                <div className="text-xs text-gray-500">Saved</div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="space-y-2 pt-4 border-t border-gray-200">
            <Link href="/marketplace/create">
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Listing
              </Button>
            </Link>
            <Link href="/profile">
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
              >
                <User className="w-4 h-4 mr-2" />
                View Profile
              </Button>
            </Link>
            <Link href="/saved-listings">
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
              >
                <Star className="w-4 h-4 mr-2" />
                Saved Items
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Compound Info Card */}
      {feedSummary && feedSummary.compound_name && (
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-gray-900">My Neighbourhood</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-gray-900">
                    {formatCompoundWithArea(feedSummary.compound_name, feedSummary.compound_area)}
                  </div>
                </div>
              </div>
              {feedSummary.compound_developer && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span className="text-xs">
                    {feedSummary.compound_developer}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Community Stats Card */}
      {feedSummary && (
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-gray-900">Community</h4>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Neighbors</span>
                <span className="text-sm font-semibold text-gray-900">
                  {feedSummary.total_neighbors || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Recent Posts</span>
                <span className="text-sm font-semibold text-gray-900">
                  {feedSummary.recent_posts_count || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Listings</span>
                <span className="text-sm font-semibold text-gray-900">
                  {feedSummary.recent_listings_count || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Post Card Component - Redesigned for warmth and engagement
function PostCard({
  post,
  newComments,
  setNewComments,
  handleCreateComment,
  createCommentMutation,
  currentUser,
}: {
  post: Post;
  newComments: Record<number, string>;
  setNewComments: (comments: Record<number, string>) => void;
  handleCreateComment: (postId: number) => void;
  createCommentMutation: any;
  currentUser?: any;
}) {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Category mapping for display
  const CATEGORY_INFO: Record<string, { icon: string; color: string; label: string; type: string; badgeColor: string }> = {
    GENERAL: { icon: "💬", color: "#6B7280", label: "General", type: "general", badgeColor: "bg-gray-100 text-gray-800 border-gray-200" },
    HELP: { icon: "🆘", color: "#F59E0B", label: "Help", type: "help", badgeColor: "bg-amber-100 text-amber-800 border-amber-200" },
    LOST_FOUND: { icon: "🔍", color: "#EC4899", label: "Lost & Found", type: "lost", badgeColor: "bg-pink-100 text-pink-800 border-pink-200" },
    EVENT: { icon: "📅", color: "#6366F1", label: "Event", type: "event", badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200" },
    MARKETPLACE: { icon: "🛒", color: "#10B981", label: "Marketplace", type: "marketplace", badgeColor: "bg-green-100 text-green-800 border-green-200" },
    ANNOUNCEMENT: { icon: "🔔", color: "#F59E0B", label: "Announcement", type: "general", badgeColor: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    ALERT: { icon: "⚠️", color: "#EF4444", label: "Alert", type: "general", badgeColor: "bg-red-100 text-red-800 border-red-200" },
    DISCUSSION: { icon: "💭", color: "#8B5CF6", label: "Discussion", type: "general", badgeColor: "bg-purple-100 text-purple-800 border-purple-200" },
  };
  
  // Use explicit category if available, otherwise fall back to auto-detection
  const getPostType = () => {
    if (post.category && CATEGORY_INFO[post.category]) {
      return CATEGORY_INFO[post.category];
    }
    // Fallback to content-based detection
    return detectPostType(post.content);
  };
  
  const postType = getPostType();
  const timeAgo = formatTimeAgo(post.created_at);
  // Only calculate isNew on client to prevent hydration mismatch
  const isNew = isMounted && 
    new Date().getTime() - new Date(post.created_at).getTime() < 3600000; // Less than 1 hour

  // Color mapping for post types
  const colorClasses = {
    help: "border-l-amber-500 bg-amber-50/30",
    lost: "border-l-pink-500 bg-pink-50/30",
    event: "border-l-indigo-500 bg-indigo-50/30",
    marketplace: "border-l-green-500 bg-green-50/30",
    general: "border-l-gray-200",
  };

  const badgeColors = {
    help: "bg-amber-100 text-amber-800 border-amber-200",
    lost: "bg-pink-100 text-pink-800 border-pink-200",
    event: "bg-indigo-100 text-indigo-800 border-indigo-200",
    marketplace: "bg-green-100 text-green-800 border-green-200",
    general: "bg-gray-100 text-gray-800 border-gray-200",
  };

  // Normalize icon handling: CATEGORY_INFO has string icons, detectPostType has component icons
  // Only render component icons after mount to prevent hydration mismatch
  const IconComponent = typeof postType.icon === 'string' ? null : postType.icon;
  const iconString = typeof postType.icon === 'string' ? postType.icon : null;

  return (
    <Card
      id={`post-${post.id}`}
      className={`border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 bg-white ${
        colorClasses[postType.type]
      }`}
    >
      <CardContent className="p-5">
        {/* Header: Avatar + Name + Time */}
        <div className="flex items-start gap-3 mb-3">
          {/* Larger avatar - 48px for more human connection */}
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0 ring-2 ring-purple-100">
              <span className="text-white font-semibold text-base">
                {post.author_name.charAt(0).toUpperCase()}
              </span>
            </div>
            {isMounted && isNew && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {/* Compound Name - Prominently displayed */}
            {isMounted && post.compound_name && (
              <div className="mb-2 flex items-center gap-1.5">
                <Home className="w-3 h-3 text-gray-500" />
                <span className="text-xs font-medium text-gray-600">
                  {formatCompoundName(post.compound_name)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold text-base text-gray-900">
                  {post.author_name}
                </div>
                {/* Verified Resident Badge */}
                {isMounted && post.author_status === "APPROVED" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">
                    <CheckCircle className="w-3 h-3" />
                    <span className="text-xs font-semibold">Verified</span>
                  </span>
                )}
                {/* Category Badge - Always show */}
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    post.category && CATEGORY_INFO[post.category] 
                      ? CATEGORY_INFO[post.category].badgeColor 
                      : badgeColors[postType.type] || "bg-gray-100 text-gray-800 border-gray-200"
                  }`}
                >
                  {isMounted && IconComponent ? (
                    <IconComponent className="w-3 h-3 inline mr-1" />
                  ) : iconString ? (
                    iconString
                  ) : null} {postType.label}
                </span>
                {/* Urgent Badge */}
                {isMounted && post.is_urgent && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                    <Bell className="w-3 h-3" />
                    <span className="text-xs font-semibold">Urgent</span>
                  </span>
                )}
              </div>
              {/* Moderator Actions - Only show if user is admin OR moderator of this compound */}
              {currentUser && (currentUser.role === "COMPOUND_MOD" || currentUser.role === "MODERATOR" || currentUser.role === "ADMIN") && (
                (currentUser.role === "ADMIN" || ((currentUser.role === "MODERATOR" || currentUser.role === "COMPOUND_MOD") && post.compound_id === currentUser.compound_id)) && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (confirm(`Are you sure you want to ban ${post.author_name}?`)) {
                          try {
                            await api.post(`/api/moderator/users/${post.author_id}/ban`, { reason: "Moderator action" });
                            toast({ title: "Success", description: "User has been banned" });
                            window.location.reload();
                          } catch (error: any) {
                            toast({ title: "Error", description: error.response?.data?.detail || "Failed to ban user", variant: "destructive" });
                          }
                        }
                      }}
                      className="p-1.5 rounded-full hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors"
                      title="Ban User"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm("Are you sure you want to delete this post?")) {
                          try {
                            await api.delete(`/api/moderator/posts/${post.id}`);
                            toast({ title: "Success", description: "Post deleted successfully" });
                            window.location.reload();
                          } catch (error: any) {
                            toast({ title: "Error", description: error.response?.data?.detail || "Failed to delete post", variant: "destructive" });
                          }
                        }
                      }}
                      className="p-1.5 rounded-full hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors"
                      title="Delete Post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              )}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </div>
          </div>
        </div>

        {/* Content */}
        <p className="text-[15px] text-gray-800 mb-4 leading-relaxed">
          {post.content}
        </p>

        {/* Inline Reactions - Facebook/WhatsApp style */}
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
          {/* Reaction buttons */}
          <div className="flex items-center gap-1">
            <button className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-all hover:scale-110 text-gray-600 hover:text-red-500">
              <span className="text-lg">❤️</span>
            </button>
            <button className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-all hover:scale-110 text-gray-600 hover:text-blue-500">
              <span className="text-lg">👍</span>
            </button>
            <button className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-all hover:scale-110 text-gray-600 hover:text-yellow-500">
              <span className="text-lg">😮</span>
            </button>
            <button className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-all hover:scale-110 text-gray-600 hover:text-purple-500">
              <span className="text-lg">🙏</span>
            </button>
          </div>

          {/* Comment button */}
          <button className="flex items-center gap-1 text-gray-600 hover:text-blue-500 transition-colors text-sm ml-2 px-2 py-1 rounded-lg hover:bg-blue-50">
            <MessageCircle className="w-4 h-4" />
            <span>{post.comments?.length || 0}</span>
          </button>

          {/* Share button */}
          <button className="flex items-center gap-1 text-gray-600 hover:text-green-500 transition-colors text-sm px-2 py-1 rounded-lg hover:bg-green-50 ml-auto">
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>

        {/* Comments Section */}
        <div className="space-y-3">
          {post.comments && post.comments.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {post.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="pl-3 border-l-2 border-purple-200 bg-purple-50/50 rounded-r-lg p-2.5 hover:bg-purple-50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center ring-1 ring-purple-200">
                      <span className="text-white text-xs font-bold">
                        {comment.author_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="font-semibold text-sm text-gray-900">
                      <span className="font-semibold">{comment.author_name}</span>
                      {/* Verified Resident Badge for Comments */}
                      {comment.author_status === "APPROVED" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">
                          <CheckCircle className="w-2.5 h-2.5" />
                          <span className="text-[10px] font-semibold">Verified</span>
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTimeAgo(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 ml-9 leading-relaxed">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Comment Input - More conversational */}
          <div className="flex gap-2 pt-2">
            <Input
              placeholder="Write a comment..."
              value={newComments[post.id] || ""}
              onChange={(e) =>
                setNewComments({
                  ...newComments,
                  [post.id]: e.target.value,
                })
              }
              onKeyPress={(e) =>
                e.key === "Enter" && handleCreateComment(post.id)
              }
              className="text-sm border-gray-300 flex-1 rounded-lg focus:ring-2 focus:ring-purple-200 bg-gray-50 focus:bg-white transition-colors"
            />
            <Button
              size="sm"
              onClick={() => handleCreateComment(post.id)}
              disabled={
                createCommentMutation.isPending || !newComments[post.id]?.trim()
              }
              className="bg-purple-600 hover:bg-purple-700 rounded-lg"
            >
              {createCommentMutation.isPending ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
