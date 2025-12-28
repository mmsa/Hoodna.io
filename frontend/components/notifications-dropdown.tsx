"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  MessageCircle,
  FileText,
  Shield,
  ShoppingBag,
  Heart,
  AtSign,
  Loader2,
} from "lucide-react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  read_at: string | null;
  related_id: number | null;
  related_type: string | null;
  metadata: Record<string, any> | null;
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
    case "VERIFICATION_REJECTED":
    case "VERIFICATION_REQUEST_MORE":
      return Shield;
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
      return "text-green-600 bg-green-50";
    case "VERIFICATION_REJECTED":
      return "text-red-600 bg-red-50";
    case "VERIFICATION_REQUEST_MORE":
      return "text-yellow-600 bg-yellow-50";
    case "MESSAGE":
    case "COMMENT":
      return "text-blue-600 bg-blue-50";
    case "LISTING_INQUIRY":
    case "LISTING_SAVED":
      return "text-purple-600 bg-purple-50";
    case "POST_LIKE":
      return "text-pink-600 bg-pink-50";
    case "MENTION":
      return "text-orange-600 bg-orange-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
}

export function NotificationsDropdown() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: notificationsData, isLoading } = useQuery<NotificationListResponse>({
    queryKey: ["notifications", open],
    queryFn: async () => {
      const response = await api.get("/api/notifications?limit=20");
      return response.data;
    },
    enabled: isAuthenticated && open,
    refetchInterval: open ? 10000 : false, // Poll every 10 seconds when open
  });

  const { data: unreadCountData } = useQuery<{ unread_count: number }>({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => {
      const response = await api.get("/api/notifications/unread-count");
      return response.data;
    },
    enabled: isAuthenticated,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const unreadCount = unreadCountData?.unread_count || 0;
  const notifications = notificationsData?.items || [];

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
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markReadMutation.mutate(notification.id);
    }

    // Navigate based on notification type
    if (notification.related_type === "message" && notification.related_id) {
      router.push(`/messages/${notification.related_id}`);
    } else if (notification.related_type === "listing" && notification.related_id) {
      router.push(`/listing/${notification.related_id}`);
    } else if (notification.related_type === "post" && notification.related_id) {
      router.push(`/feed`);
    } else if (notification.type.includes("VERIFICATION")) {
      router.push("/verification");
    } else {
      router.push("/notifications");
    }
    setOpen(false);
  };

  if (!isAuthenticated) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-gray-100 rounded-full"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-96 max-h-[600px] overflow-y-auto p-0"
        ref={dropdownRef}
      >
        <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-lg">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-xs h-7"
              >
                {markAllReadMutation.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <CheckCheck className="w-3 h-3 mr-1" />
                )}
                Mark all read
              </Button>
            )}
          </div>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-600">
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">No notifications</p>
            <p className="text-xs text-gray-500">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => {
              const Icon = getNotificationIcon(notification.type);
              const colorClass = getNotificationColor(notification.type);

              return (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors group ${
                    !notification.read ? "bg-blue-50/50" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p
                            className={`text-sm font-medium ${
                              !notification.read ? "font-semibold" : ""
                            }`}
                          >
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatTime(notification.created_at)}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(notification.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3 text-gray-400" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {notifications.length > 0 && (
          <div className="p-3 border-t bg-gray-50">
            <Button
              variant="ghost"
              className="w-full text-sm"
              onClick={() => {
                router.push("/notifications");
                setOpen(false);
              }}
            >
              View all notifications
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

