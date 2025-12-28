"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import {
  Send,
  MessageCircle,
  Heart,
  Share2,
  Users,
  Sparkles,
  Home,
  MapPin,
  Building2,
  ShoppingBag,
  TrendingUp,
  Bell,
  Calendar,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";

interface Post {
  id: number;
  author_name: string;
  content: string;
  created_at: string;
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

export default function FeedPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [newPost, setNewPost] = useState("");
  const [newComments, setNewComments] = useState<Record<number, string>>({});
  const queryClient = useQueryClient();

  // Fetch feed summary
  const { data: feedSummary } = useQuery<FeedSummary>({
    queryKey: ["feed-summary"],
    queryFn: async () => {
      const response = await api.get("/api/feed/summary");
      return response.data;
    },
    retry: false,
  });

  // Fetch recent listings
  const { data: recentListings } = useQuery<Listing[]>({
    queryKey: ["recent-listings"],
    queryFn: async () => {
      const response = await api.get("/api/marketplace?scope=compound&limit=5");
      return response.data;
    },
    retry: false,
  });

  const { data: posts, isLoading, error } = useQuery<Post[]>({
    queryKey: ["feed"],
    queryFn: async () => {
      const response = await api.get("/api/feed");
      return response.data;
    },
    retry: false,
  });

  // Redirect based on error type
  useEffect(() => {
    if (error) {
      const errorResponse = (error as any).response;
      const errorDetail = errorResponse?.data?.detail || "";

      // Redirect to compound selection if compound not selected
      if (
        errorResponse?.status === 400 &&
        errorDetail.includes("compound")
      ) {
        router.push("/onboarding/compound-select");
      }
      // Redirect to verification if user not verified
      else if (
        errorResponse?.status === 403 &&
        (errorDetail.includes("verified") || errorDetail.includes("approved"))
      ) {
        router.push("/verification");
      }
    }
  }, [error, router]);

  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.post("/api/posts", { content });
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
    mutationFn: async ({ postId, content }: { postId: number; content: string }) => {
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading community feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Compound Info & Profile */}
          <div className="lg:col-span-1 space-y-6">
            {/* Compound Info Card */}
            {feedSummary?.compound_name && (
              <Card className="shadow-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                      <Home className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl text-gray-900">
                        {feedSummary.compound_name}
                      </CardTitle>
                      {feedSummary.compound_area && (
                        <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {feedSummary.compound_area}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {feedSummary.compound_developer && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Building2 className="w-4 h-4 text-gray-500" />
                      <span>{feedSummary.compound_developer}</span>
                    </div>
                  )}
                  {feedSummary.compound_status && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        {feedSummary.compound_status}
                      </span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Neighbors</span>
                      <span className="font-semibold text-gray-900">
                        {feedSummary.total_neighbors}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-gray-600">Posts</span>
                      <span className="font-semibold text-gray-900">
                        {feedSummary.recent_posts_count}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* User Profile Card */}
            {user && (
              <Card className="shadow-lg border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-md">
                      <span className="text-white font-bold text-lg">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg text-gray-900">
                        {user.name}
                      </CardTitle>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Link href="/profile">
                    <Button
                      variant="outline"
                      className="w-full border-purple-200 hover:bg-purple-50"
                    >
                      <User className="w-4 h-4 mr-2" />
                      View Profile
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* What's New Section */}
            {recentListings && recentListings.length > 0 && (
              <Card className="shadow-lg border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <CardTitle className="text-lg text-gray-900">
                      What's New
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentListings.slice(0, 3).map((listing) => (
                    <Link
                      key={listing.id}
                      href={`/marketplace/${listing.id}`}
                      className="block p-3 rounded-lg bg-white border border-green-100 hover:border-green-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-3">
                        {listing.image_urls && listing.image_urls.length > 0 ? (
                          <img
                            src={listing.image_urls[0]}
                            alt={listing.title}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center">
                            <ShoppingBag className="w-8 h-8 text-white" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-gray-900 truncate">
                            {listing.title}
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            {listing.category}
                          </p>
                          <p className="text-sm font-bold text-green-600 mt-1">
                            {listing.currency} {listing.price}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                  <Link href="/marketplace">
                    <Button
                      variant="outline"
                      className="w-full border-green-200 hover:bg-green-50 text-sm"
                    >
                      View All Listings
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="text-center mb-6 animate-fade-in">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Community Feed
              </h1>
              <p className="text-gray-600">
                Connect with your neighbors in {feedSummary?.compound_name || "your community"}
              </p>
            </div>

            {/* Create Post */}
            <Card className="shadow-xl border-2 border-gray-200 hover:shadow-2xl transition-all duration-300 animate-fade-in">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Share something</h3>
                    <p className="text-sm text-gray-500">What's on your mind?</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Share your thoughts with the community..."
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && handleCreatePost()
                    }
                    className="flex-1 border-2 focus:border-blue-400 transition-colors"
                  />
                  <Button
                    onClick={handleCreatePost}
                    disabled={
                      createPostMutation.isPending || !newPost.trim()
                    }
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                    size="lg"
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

            {/* Posts */}
            {posts && posts.length === 0 ? (
              <Card className="shadow-lg border-2 border-dashed border-gray-300">
                <CardContent className="p-12 text-center">
                  <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    No posts yet
                  </h3>
                  <p className="text-gray-500">
                    Be the first to share something with your community!
                  </p>
                </CardContent>
              </Card>
            ) : (
              posts?.map((post, index) => (
                <Card
                  key={post.id}
                  className="shadow-lg border-2 border-gray-200 hover:shadow-xl transition-all duration-300 hover:scale-[1.01] animate-fade-in"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-lg">
                          {post.author_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-lg text-gray-900">
                          {post.author_name}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          {new Date(post.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <p className="mb-6 text-gray-800 leading-relaxed">
                      {post.content}
                    </p>

                    {/* Action buttons */}
                    <div className="flex items-center gap-4 mb-4 pb-4 border-b">
                      <button className="flex items-center gap-2 text-gray-600 hover:text-red-500 transition-colors">
                        <Heart className="w-5 h-5" />
                        <span className="text-sm">Like</span>
                      </button>
                      <button className="flex items-center gap-2 text-gray-600 hover:text-blue-500 transition-colors">
                        <MessageCircle className="w-5 h-5" />
                        <span className="text-sm">
                          {post.comments?.length || 0} Comments
                        </span>
                      </button>
                      <button className="flex items-center gap-2 text-gray-600 hover:text-green-500 transition-colors">
                        <Share2 className="w-5 h-5" />
                        <span className="text-sm">Share</span>
                      </button>
                    </div>

                    {/* Comments */}
                    <div className="space-y-4">
                      {post.comments && post.comments.length > 0 && (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {post.comments.map((comment) => (
                            <div
                              key={comment.id}
                              className="pl-4 border-l-4 border-blue-200 bg-blue-50 rounded-r-lg p-3 animate-fade-in"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">
                                    {comment.author_name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="font-semibold text-sm text-gray-900">
                                  {comment.author_name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(comment.created_at).toLocaleDateString()}
                                </div>
                              </div>
                              <p className="text-sm text-gray-700 ml-8">
                                {comment.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Comment */}
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
                          className="text-sm border-2 focus:border-blue-400 transition-colors"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleCreateComment(post.id)}
                          disabled={
                            createCommentMutation.isPending ||
                            !newComments[post.id]?.trim()
                          }
                          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
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
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
