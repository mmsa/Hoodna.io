"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bell,
  CheckCheck,
  Trash2,
  MessageCircle,
  Shield,
  ShoppingBag,
  Heart,
  AtSign,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { notificationHref } from "@/lib/notification-routing";
import { track } from "@/lib/telemetry";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  read_at: string | null;
  related_id: number | null;
  related_type: string | null;
  extra_data: Record<string, any> | null;
  created_at: string;
}

interface NotificationListResponse {
  items: Notification[];
  total: number;
  unread_count: number;
  skip: number;
  limit: number;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "MESSAGE":
      return MessageCircle;
    case "COMMENT":
      return MessageCircle;
    case "VERIFICATION_APPROVED":
      return CheckCircle;
    case "VERIFICATION_REJECTED":
      return XCircle;
    case "VERIFICATION_REQUEST_MORE":
      return AlertCircle;
    case "LISTING_INQUIRY":
    case "LISTING_SAVED":
      return ShoppingBag;
    case "POST_LIKE":
      return Heart;
    case "MENTION":
      return AtSign;
    default:
      return Bell;
  }
}

function getNotificationColor(type: string) {
  switch (type) {
    case "VERIFICATION_APPROVED":
      return "text-green-600 bg-green-50 border-green-200";
    case "VERIFICATION_REJECTED":
      return "text-red-600 bg-red-50 border-red-200";
    case "VERIFICATION_REQUEST_MORE":
      return "text-yellow-600 bg-yellow-50 border-yellow-200";
    case "MESSAGE":
    case "COMMENT":
      return "text-primary bg-secondary border-border";
    case "LISTING_INQUIRY":
    case "LISTING_SAVED":
      return "text-primary bg-secondary border-border";
    case "POST_LIKE":
      return "text-pink-600 bg-pink-50 border-pink-200";
    case "MENTION":
      return "text-orange-600 bg-orange-50 border-orange-200";
    default:
      return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data: notificationsData, isLoading } = useQuery<NotificationListResponse>({
    queryKey: ["notifications", page, filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("skip", String((page - 1) * pageSize));
      params.append("limit", String(pageSize));
      if (filter === "unread") {
        params.append("unread_only", "true");
      }
      const response = await api.get(`/api/notifications?${params.toString()}`);
      return response.data;
    },
    enabled: isAuthenticated,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const notifications = notificationsData?.items || [];
  const total = notificationsData?.total || 0;
  const unreadCount = notificationsData?.unread_count || 0;
  const totalPages = Math.ceil(total / pageSize);

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      await api.patch(`/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.post("/api/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      toast({
        title: "All notifications marked as read",
        variant: "success",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      await api.delete(`/api/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      toast({
        title: "Notification deleted",
        variant: "success",
      });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markReadMutation.mutate(notification.id);
    }

    track("notification_opened", {
      notification_id: notification.id,
      notification_type: notification.type,
      source_screen: "notifications",
    });

    if (notification.related_type === "message" && notification.related_id) {
      router.push(`/messages/${notification.related_id}`);
    } else if (notification.type.includes("VERIFICATION")) {
      router.push("/verification");
    } else {
      router.push(notificationHref(notification));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to view notifications</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary mb-4 shadow-lg">
            <Bell className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Notifications
          </h1>
          <p className="text-gray-600">
            Stay updated with your community activity
          </p>
        </div>

        {/* Stats and Actions */}
        <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{total}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Unread</p>
                  <p className="text-2xl font-bold text-primary">{unreadCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={filter === "all" ? "default" : "outline"}
                  onClick={() => {
                    setFilter("all");
                    setPage(1);
                  }}
                  size="sm"
                >
                  All
                </Button>
                <Button
                  variant={filter === "unread" ? "default" : "outline"}
                  onClick={() => {
                    setFilter("unread");
                    setPage(1);
                  }}
                  size="sm"
                >
                  Unread ({unreadCount})
                </Button>
                {unreadCount > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                    size="sm"
                  >
                    {markAllReadMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCheck className="w-4 h-4 mr-2" />
                    )}
                    Mark all read
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        {isLoading ? (
          <Card className="shadow-lg">
            <CardContent className="p-12 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-gray-600">Loading notifications...</p>
            </CardContent>
          </Card>
        ) : notifications.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="p-12 text-center">
              <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {filter === "unread" ? "No unread notifications" : "No notifications"}
              </h3>
              <p className="text-gray-500">
                {filter === "unread"
                  ? "You're all caught up!"
                  : "You'll see notifications here when you receive them."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => {
              const Icon = getNotificationIcon(notification.type);
              const colorClass = getNotificationColor(notification.type);

              return (
                <Card
                  key={notification.id}
                  className={`shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer ${
                    !notification.read ? "border-l-4 border-l-primary bg-secondary/30" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border-2 ${colorClass}`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3
                                className={`text-base font-semibold ${
                                  !notification.read ? "text-gray-900" : "text-gray-700"
                                }`}
                              >
                                {notification.title}
                              </h3>
                              {!notification.read && (
                                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatTime(notification.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markReadMutation.mutate(notification.id);
                                }}
                              >
                                <CheckCircle className="w-4 h-4 text-gray-400" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMutation.mutate(notification.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-gray-400" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page <span className="font-semibold">{page}</span> of{" "}
                  <span className="font-semibold">{totalPages}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    size="sm"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

