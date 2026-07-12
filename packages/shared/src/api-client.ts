import {
  TokenResponse,
  PhoneAuthStartRequest,
  PhoneAuthStartResponse,
  PhoneAuthVerifyRequest,
  UserLogin,
  UserSignup,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from "./schemas/auth";
import { User } from "./schemas/user";
import { VerificationStatusResponse, PresignRequest, PresignResponse, DocumentSubmit } from "./schemas/verification";
import { Post, PostCreate, CommentCreate } from "./schemas/post";
import { Listing, ListingCreate } from "./schemas/listing";
import { Compound } from "./schemas/compound";

export class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    // Remove automatic timeouts - let React Native's fetch handle timeouts naturally
    // Timeouts were causing issues on slower networks
    // If timeout is needed, it can be added via options.timeout in the future
    try {
      const { timeout, ...fetchOptions } = options;
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        const errorMessage = (error as { detail?: string }).detail || `HTTP ${response.status}`;
        throw new Error(errorMessage);
      }

      return response.json() as Promise<T>;
    } catch (error: any) {
      // Improve error messages for network issues
      if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        throw new Error(`Cannot connect to server at ${this.baseUrl}. Please check:\n1. Backend is running\n2. Phone and computer are on same WiFi\n3. IP address is correct`);
      }
      if (error.message?.includes('timeout') || error.name === 'AbortError') {
        throw new Error(`Request timed out. Server at ${this.baseUrl} may be unreachable.`);
      }
      throw error;
    }
  }

  // Auth
  async signup(data: UserSignup): Promise<TokenResponse> {
    return this.request<TokenResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async login(data: UserLogin): Promise<TokenResponse> {
    return this.request<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async forgotPassword(data: ForgotPasswordRequest): Promise<{ message: string }> {
    return this.request<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
    return this.request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async phoneAuthStart(data: PhoneAuthStartRequest): Promise<PhoneAuthStartResponse> {
    return this.request<PhoneAuthStartResponse>("/api/auth/start", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async phoneAuthVerify(data: PhoneAuthVerifyRequest): Promise<TokenResponse> {
    return this.request<TokenResponse>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>("/api/auth/me");
  }

  async getUserCompounds(): Promise<
    Array<{ id: number; name: string; area: string | null; is_current: boolean; is_verified: boolean }>
  > {
    return this.request<
      Array<{ id: number; name: string; area: string | null; is_current: boolean; is_verified: boolean }>
    >("/api/auth/me/compounds");
  }

  async switchCompound(compoundId: number): Promise<User> {
    return this.request<User>("/api/auth/me/switch-compound", {
      method: "POST",
      body: JSON.stringify({ compound_id: compoundId }),
    });
  }

  async globalSearch(query: string): Promise<{
    query: string;
    posts: Array<{
      type: string;
      id: number;
      title: string;
      content?: string;
      author_name?: string;
      compound_name?: string;
      category?: string;
      created_at: string;
    }>;
    listings: Array<{
      type: string;
      id: number;
      title: string;
      content?: string;
      author_name?: string;
      compound_name?: string;
      category?: string;
      price?: number;
      created_at: string;
    }>;
    services: Array<{
      type: string;
      id: number;
      title: string;
      content?: string;
      author_name?: string;
      compound_name?: string;
      category?: string;
      price?: number;
      created_at: string;
    }>;
    total_results: number;
  }> {
    return this.request(`/api/search/global?q=${encodeURIComponent(query)}`, {
      method: "GET",
    });
  }

  async requestCompoundAccess(compoundId: number): Promise<{ message: string; compound_id: number; compound_name: string }> {
    return this.request<{ message: string; compound_id: number; compound_name: string }>("/api/auth/me/request-compound-access", {
      method: "POST",
      body: JSON.stringify({ compound_id: compoundId }),
    });
  }

  // Verification
  async getVerificationStatus(): Promise<VerificationStatusResponse> {
    return this.request<VerificationStatusResponse>("/api/verification/status");
  }

  async getPresignedUrl(data: PresignRequest): Promise<PresignResponse> {
    return this.request<PresignResponse>("/api/verification/presign", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async submitDocument(data: DocumentSubmit): Promise<any> {
    return this.request("/api/verification/submit", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getSignedFileUrl(fileUrl: string): Promise<string> {
    const params = new URLSearchParams({ file_url: fileUrl });
    try {
      const res = await this.request<{ url: string }>(
        `/api/uploads/signed-url?${params.toString()}`
      );
      return res.url;
    } catch {
      const res = await this.request<{ url: string }>(
        `/api/verification/signed-url?${params.toString()}`
      );
      return res.url;
    }
  }

  // Posts
  async getPosts(compoundId?: number, skip = 0, limit = 50): Promise<Post[]> {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    });
    if (compoundId) {
      params.append("compound_id", compoundId.toString());
    }
    return this.request<Post[]>(`/api/posts?${params}`);
  }

  async getAnnouncements(limit = 5): Promise<Post[]> {
    return this.request<Post[]>(`/api/feed/announcements?limit=${limit}`);
  }

  async createPost(data: PostCreate): Promise<Post> {
    return this.request<Post>("/api/posts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async createComment(postId: number, data: CommentCreate): Promise<any> {
    return this.request(`/api/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Listings
  async getListings(params?: {
    scope?: string;
    skip?: number;
    limit?: number;
    category?: string;
    intent?: string;
    search?: string;
    sort_by?: string;
    min_price?: number | string;
    max_price?: number | string;
  }): Promise<Listing[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          queryParams.append(key, value.toString());
        }
      });
    }
    return this.request<Listing[]>(`/api/listings?${queryParams}`);
  }

  async getListing(id: number): Promise<Listing> {
    return this.request<Listing>(`/api/listings/${id}`);
  }

  async createListing(data: ListingCreate): Promise<Listing> {
    return this.request<Listing>("/api/listings", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async saveListing(listingId: number): Promise<{ message: string; saved: boolean }> {
    return this.request<{ message: string; saved: boolean }>(`/api/listings/${listingId}/save`, {
      method: "POST",
    });
  }

  async unsaveListing(listingId: number): Promise<{ message: string; saved: boolean }> {
    return this.request<{ message: string; saved: boolean }>(`/api/listings/${listingId}/save`, {
      method: "DELETE",
    });
  }

  async sendMessage(data: {
    recipient_id: number;
    content: string;
    listing_id?: number | null;
  }): Promise<any> {
    return this.request("/api/messages", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getConversations(skip = 0, limit = 50): Promise<any[]> {
    return this.request<any[]>(`/api/conversations?skip=${skip}&limit=${limit}`);
  }

  async getConversation(conversationId: number): Promise<any> {
    return this.request<any>(`/api/conversations/${conversationId}`);
  }

  async sendMessageToConversation(conversationId: number, content: string): Promise<any> {
    return this.request<any>(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  // Compounds
  async getCompounds(params?: {
    area?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<Compound[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, value.toString());
          }
        });
      }
      const response = await this.request<{ items: Compound[]; total: number; limit: number; offset: number }>(`/api/compounds?${queryParams}`);
      // Backend returns CompoundListResponse with items array
      return Array.isArray(response?.items) ? response.items : [];
    } catch (error) {
      console.error("Failed to fetch compounds:", error);
      return [];
    }
  }

  // Notifications
  async getNotifications(params?: {
    skip?: number;
    limit?: number;
    unread_only?: boolean;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    return this.request<any>(`/api/notifications?${queryParams}`);
  }

  async getUnreadNotificationCount(): Promise<{ unread_count: number }> {
    return this.request<{ unread_count: number }>("/api/notifications/unread-count");
  }

  async markNotificationRead(notificationId: number): Promise<any> {
    return this.request<any>(`/api/notifications/${notificationId}/read`, {
      method: "PATCH",
    });
  }

  async markAllNotificationsRead(): Promise<{ message: string; count: number }> {
    return this.request<{ message: string; count: number }>("/api/notifications/mark-all-read", {
      method: "POST",
    });
  }

  async deleteNotification(notificationId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/notifications/${notificationId}`, {
      method: "DELETE",
    });
  }

  // Reports
  async reportPost(postId: number, data: {
    reason: string;
    description?: string;
  }): Promise<any> {
    return this.request<any>(`/api/reports/post/${postId}`, {
      method: "POST",
      body: JSON.stringify({
        reported_type: "post",
        reported_id: postId,
        reason: data.reason,
        description: data.description,
      }),
    });
  }

  async reportListing(listingId: number, data: {
    reason: string;
    description?: string;
  }): Promise<any> {
    return this.request<any>(`/api/reports/listing/${listingId}`, {
      method: "POST",
      body: JSON.stringify({
        reported_type: "listing",
        reported_id: listingId,
        reason: data.reason,
        description: data.description,
      }),
    });
  }

  // Moderator actions
  async deletePost(postId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/moderator/posts/${postId}`, {
      method: "DELETE",
    });
  }

  async banUser(userId: number, reason?: string): Promise<{ message: string; user: any }> {
    return this.request<{ message: string; user: any }>(`/api/moderator/users/${userId}/ban`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || null }),
    });
  }

  async deleteListing(listingId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/moderator/listings/${listingId}`, {
      method: "DELETE",
    });
  }

  // Update listing (for owners)
  async updateListing(listingId: number, data: Partial<ListingCreate>): Promise<Listing> {
    return this.request<Listing>(`/api/listings/${listingId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // Delete listing (for owners - soft delete)
  async deleteOwnListing(listingId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/listings/${listingId}`, {
      method: "DELETE",
    });
  }

  // Feed endpoints
  async getFeedSummary(): Promise<{
    compound_name: string | null;
    compound_area: string | null;
    compound_developer: string | null;
    compound_status: string | null;
    recent_listings_count: number;
    recent_posts_count: number;
    total_neighbors: number;
  }> {
    return this.request("/api/feed/summary");
  }

  async getFeed(limit = 15): Promise<Post[]> {
    return this.request<Post[]>(`/api/feed?limit=${limit}`);
  }

  // Provider endpoints
  async getProviderProfile(): Promise<any> {
    return this.request("/api/providers/me");
  }

  async updateProviderProfile(data: any): Promise<any> {
    return this.request("/api/providers/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async requestProviderChange(data: {
    category_id?: number;
    service_area_compound_ids?: number[];
    reason: string;
  }): Promise<any> {
    return this.request("/api/providers/me/request-change", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Moderator endpoints
  async getModeratorProfile(): Promise<any> {
    return this.request("/api/moderators/me");
  }

  async getModeratorReports(): Promise<any[]> {
    return this.request("/api/reports");
  }

  async resolveReport(reportId: number, status: "REVIEWED" | "RESOLVED" | "DISMISSED" = "RESOLVED"): Promise<any> {
    return this.request(`/api/reports/${reportId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async getModeratorPosts(compoundId: number): Promise<Post[]> {
    return this.request<Post[]>(`/api/posts?compound_id=${compoundId}`);
  }

  async restorePost(postId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/moderator/posts/${postId}/restore`, {
      method: "POST",
    });
  }

  async restoreListing(listingId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/moderator/listings/${listingId}/restore`, {
      method: "POST",
    });
  }

  // Reviews endpoints
  async getListingReviews(listingId: number): Promise<any[]> {
    return this.request<any[]>(`/api/listings/${listingId}/reviews`);
  }

  async createReview(listingId: number, data: {
    rating: number;
    comment?: string;
  }): Promise<any> {
    return this.request(`/api/listings/${listingId}/reviews`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateReview(reviewId: number, data: {
    rating: number;
    comment?: string;
  }): Promise<any> {
    return this.request(`/api/reviews/${reviewId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteReview(reviewId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/reviews/${reviewId}`, {
      method: "DELETE",
    });
  }

  // Saved items
  async getSavedListings(): Promise<Listing[]> {
    return this.request<Listing[]>("/api/saved-listings");
  }

  async getSavedPosts(): Promise<Post[]> {
    return this.request<Post[]>("/api/saved-posts");
  }

  async savePost(postId: number): Promise<{ message: string; saved: boolean }> {
    return this.request<{ message: string; saved: boolean }>(`/api/posts/${postId}/save`, {
      method: "POST",
    });
  }

  async unsavePost(postId: number): Promise<{ message: string; saved: boolean }> {
    return this.request<{ message: string; saved: boolean }>(`/api/posts/${postId}/save`, {
      method: "DELETE",
    });
  }

  // Promotions
  async createPromotionCheckout(listingId: number, data: {
    scope: "CROSS_COMPOUND" | "PUBLIC";
  }): Promise<{ checkout_url: string; session_id: string }> {
    return this.request<{ checkout_url: string; session_id: string }>("/api/promotions/checkout", {
      method: "POST",
      body: JSON.stringify({
        listing_id: listingId,
        ...data,
      }),
    });
  }

  // Admin endpoints (for admin panel - web only typically)
  async getAdminProviders(statusFilter?: string): Promise<any[]> {
    const params = statusFilter ? `?status_filter=${statusFilter}` : "";
    return this.request<any[]>(`/api/admin/providers${params}`);
  }

  async approveProvider(providerId: number): Promise<any> {
    return this.request(`/api/admin/providers/${providerId}/approve`, {
      method: "POST",
    });
  }

  async rejectProvider(providerId: number, reason: string): Promise<any> {
    return this.request(`/api/admin/providers/${providerId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  async getAdminModerators(statusFilter?: string): Promise<any[]> {
    const params = statusFilter ? `?status_filter=${statusFilter}` : "";
    return this.request<any[]>(`/api/admin/moderators${params}`);
  }

  async approveModerator(moderatorId: number): Promise<any> {
    return this.request(`/api/admin/moderators/${moderatorId}/approve`, {
      method: "POST",
    });
  }

  async rejectModerator(moderatorId: number, reason: string): Promise<any> {
    return this.request(`/api/admin/moderators/${moderatorId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  async getAdminUsers(params?: {
    skip?: number;
    limit?: number;
    search?: string;
    role_filter?: string;
    status_filter?: string;
    compound_id?: number;
    sort_by?: string;
  }): Promise<{ items: any[]; total: number; skip: number; limit: number }> {
    const searchParams = new URLSearchParams();
    if (params?.skip != null) searchParams.set("skip", String(params.skip));
    if (params?.limit != null) searchParams.set("limit", String(params.limit));
    if (params?.search) searchParams.set("search", params.search);
    if (params?.role_filter) searchParams.set("role_filter", params.role_filter);
    if (params?.status_filter) searchParams.set("status_filter", params.status_filter);
    if (params?.compound_id != null) searchParams.set("compound_id", String(params.compound_id));
    if (params?.sort_by) searchParams.set("sort_by", params.sort_by);
    const qs = searchParams.toString();
    return this.request(`/api/admin/users${qs ? `?${qs}` : ""}`);
  }

  async getAdminUserDetail(userId: number): Promise<any> {
    return this.request(`/api/admin/users/${userId}`);
  }

  async adminResetUserPassword(data: { email: string; new_password: string }): Promise<{ message: string }> {
    return this.request("/api/admin/users/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminApproveUser(userId: number): Promise<any> {
    return this.request(`/api/admin/users/${userId}/approve`, { method: "POST" });
  }

  async adminRejectUser(userId: number): Promise<any> {
    return this.request(`/api/admin/users/${userId}/reject`, { method: "POST" });
  }

  async adminBanUser(userId: number): Promise<any> {
    return this.request(`/api/admin/users/${userId}/ban`, { method: "POST" });
  }
}

