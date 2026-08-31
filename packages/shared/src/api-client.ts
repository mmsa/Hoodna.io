import {
  TokenResponse,
  PhoneAuthStartRequest,
  PhoneAuthStartResponse,
  PhoneAuthVerifyRequest,
  UserLogin,
  UserSignup,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ResetPasswordPhoneRequest,
} from "./schemas/auth";
import { User } from "./schemas/user";
import { VerificationStatusResponse, PresignRequest, PresignResponse, DocumentSubmit } from "./schemas/verification";
import { Post, PostCreate, CommentCreate } from "./schemas/post";
import { Listing, ListingCreate, ListingUpdate } from "./schemas/listing";
import { ServiceCategory } from "./schemas/service-category";
import { Compound } from "./schemas/compound";
import {
  ReferralCreate,
  ReferralInvite,
  ReferralMe,
  ReferralRedeem,
  ReferralRedeemResponse,
  ReferralStats,
} from "./schemas/referral";
import {
  AdminBusinessUpdate,
  BusinessClaim,
  BusinessClaimCreate,
  BusinessClaimReview,
  BusinessCreate,
  BusinessDetail,
  BusinessDirectoryResponse,
  BusinessMembership,
  BusinessOffer,
  BusinessOfferCreate,
  BusinessOfferUpdate,
  BusinessAnalytics,
} from "./schemas/business";
import { ReportCreate, ReportEntityType, ReportResponse, ReportUpdate } from "./schemas/report";
import {
  AccountDeletionRequest,
  AccountDeletionRequestCreate,
  PublicUserProfile,
  UserPreferences,
  UserPreferencesUpdate,
} from "./schemas/preferences";
import {
  FeatureConfig,
  FeatureFlag,
  FeatureFlagKey,
  FeatureFlagOverride,
  FeatureFlagUpdate,
} from "./schemas/feature-flags";
import { AnalyticsEventBatch, ClientErrorReport } from "./schemas/analytics";
import { DigestSummary } from "./schemas/digest";
import { AdminAuditList, AdminBetaMetrics } from "./schemas/admin";

type RequestOptions = RequestInit & {
  timeout?: number;
  skipAuthRefresh?: boolean;
  hasRetriedAuth?: boolean;
};

export class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshAccessToken: (() => Promise<string | null>) | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  setTokenRefresher(refresher: (() => Promise<string | null>) | null) {
    this.refreshAccessToken = refresher;
  }

  async request<T>(
    endpoint: string,
    options: RequestOptions = {}
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
      const {
        timeout,
        skipAuthRefresh,
        hasRetriedAuth,
        ...fetchOptions
      } = options;
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });

      if (
        response.status === 401 &&
        !skipAuthRefresh &&
        !hasRetriedAuth &&
        this.refreshAccessToken
      ) {
        const nextToken = await this.refreshAccessToken();
        if (nextToken) {
          this.setAccessToken(nextToken);
          return this.request<T>(endpoint, { ...options, hasRetriedAuth: true });
        }
      }

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

  /** Generic injected transport used by Eljiran telemetry adapters. */
  async post<T = unknown>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
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

  async refreshSession(refreshToken: string): Promise<TokenResponse> {
    return this.request<TokenResponse>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
      skipAuthRefresh: true,
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

  async resetPasswordPhone(data: ResetPasswordPhoneRequest): Promise<{ message: string }> {
    return this.request<{ message: string }>("/api/auth/reset-password-phone", {
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

  async confirmPhoneOtp(data: { otp_code: string }): Promise<{ message: string; phone_verified: boolean }> {
    return this.request("/api/auth/confirm-phone", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async confirmEmailOtp(data: { otp_code: string }): Promise<{ message: string; email_verified: boolean }> {
    return this.request("/api/auth/confirm-email", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async resendContactOtp(): Promise<{
    phone_sent: boolean;
    email_sent: boolean;
    dev_phone_otp?: string;
    dev_email_otp?: string;
  }> {
    return this.request("/api/auth/resend-contact-otp", {
      method: "POST",
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>("/api/auth/me");
  }

  async getAvatarPresignedUrl(data: {
    file_name: string;
    file_type: string;
  }): Promise<PresignResponse> {
    return this.request<PresignResponse>("/api/auth/me/avatar/presign", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateAvatar(avatarUrl: string): Promise<User> {
    return this.request<User>("/api/auth/me/avatar", {
      method: "PUT",
      body: JSON.stringify({ avatar_url: avatarUrl }),
    });
  }

  async getUserCompounds(): Promise<
    Array<{
      id: number;
      name: string;
      area: string | null;
      is_current: boolean;
      is_verified: boolean;
      verification_status: "PENDING" | "VERIFIED";
    }>
  > {
    return this.request<
      Array<{
        id: number;
        name: string;
        area: string | null;
        is_current: boolean;
        is_verified: boolean;
        verification_status: "PENDING" | "VERIFIED";
      }>
    >("/api/auth/me/compounds");
  }

  async switchCompound(compoundId: number): Promise<User> {
    return this.request<User>("/api/auth/me/switch-compound", {
      method: "POST",
      body: JSON.stringify({ compound_id: compoundId }),
    });
  }

  async completeProfile(data: {
    name: string;
    password: string;
    imported_content_choice?: "KEEP" | "DISCARD";
  }): Promise<User> {
    return this.request<User>("/api/auth/me/complete-profile", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getImportedContentSummary(): Promise<{
    needs_choice: boolean;
    posts: number;
    comments: number;
    listings: number;
    total: number;
    choice?: string | null;
  }> {
    return this.request("/api/auth/me/imported-content");
  }

  async deleteOwnPost(postId: number): Promise<void> {
    await this.request(`/api/posts/${postId}`, { method: "DELETE" });
  }

  async getCompoundInvites(): Promise<
    Array<{
      compound_id: number;
      compound_name: string;
      compound_area?: string | null;
      verification_source: string;
      created_at?: string | null;
    }>
  > {
    return this.request("/api/auth/me/compound-invites");
  }

  async confirmCompoundInvite(compoundId: number): Promise<{
    compound_id: number;
    verification_status: string;
    user_status: string;
  }> {
    return this.request(`/api/auth/me/compound-invites/${compoundId}/confirm`, {
      method: "POST",
    });
  }

  async declineCompoundInvite(compoundId: number): Promise<void> {
    await this.request(`/api/auth/me/compound-invites/${compoundId}/decline`, {
      method: "POST",
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

  async votePoll(postId: number, optionId: number): Promise<Post> {
    return this.request<Post>(`/api/posts/${postId}/poll/vote`, {
      method: "POST",
      body: JSON.stringify({ option_id: optionId }),
    });
  }

  async askNeighbours(question: string): Promise<{
    answer: string;
    citations: Array<{
      type: string;
      id: number;
      title: string;
      url_path: string;
      snippet?: string;
    }>;
    used_llm: boolean;
  }> {
    return this.request("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
    });
  }

  async createComment(postId: number, data: CommentCreate): Promise<any> {
    return this.request(`/api/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async reactToPost(
    postId: number,
    reaction: "LOVE" | "LIKE" | "WOW" | "PRAY",
  ): Promise<{ reaction_counts: Record<string, number>; user_reaction: string | null }> {
    return this.request(`/api/posts/${postId}/reaction`, {
      method: "PUT",
      body: JSON.stringify({ reaction }),
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

  async getListingImagePresignedUrl(data: {
    file_name: string;
    file_type: string;
  }): Promise<PresignResponse> {
    return this.request<PresignResponse>("/api/listings/images/presign", {
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
  async updateListing(listingId: number, data: ListingUpdate): Promise<Listing> {
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
    compound_hero_image_url?: string | null;
    recent_listings_count: number;
    recent_posts_count: number;
    total_neighbors: number;
  }> {
    return this.request("/api/feed/summary");
  }

  async getFeed(limit = 15, search?: string): Promise<Post[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (search?.trim()) params.set("search", search.trim());
    return this.request<Post[]>(`/api/feed?${params.toString()}`);
  }

  async getLinkPreview(url: string): Promise<{
    url: string;
    title?: string | null;
    description?: string | null;
    image?: string | null;
    site_name?: string | null;
    kind: string;
  }> {
    const params = new URLSearchParams({ url });
    return this.request(`/api/link-preview?${params.toString()}`);
  }

  // Service categories
  async getServiceCategories(): Promise<ServiceCategory[]> {
    return this.request<ServiceCategory[]>("/api/service-categories");
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

  async adminSetUserCompounds(
    userId: number,
    data: {
      compound_ids: number[];
      primary_compound_id?: number | null;
      approve_user?: boolean;
    }
  ): Promise<any> {
    return this.request(`/api/admin/users/${userId}/compounds`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // Eljiran referrals
  async getReferralMe(): Promise<ReferralMe> {
    return this.request<ReferralMe>("/api/referrals/me");
  }

  async createReferralInvite(data: ReferralCreate = {}): Promise<ReferralInvite> {
    return this.request<ReferralInvite>("/api/referrals/invites", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getReferralInvites(): Promise<ReferralInvite[]> {
    return this.request<ReferralInvite[]>("/api/referrals/invites");
  }

  async getReferralStats(): Promise<ReferralStats> {
    return this.request<ReferralStats>("/api/referrals/stats");
  }

  async redeemReferral(data: ReferralRedeem): Promise<ReferralRedeemResponse> {
    return this.request<ReferralRedeemResponse>("/api/referrals/redeem", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Eljiran business directory and claims
  async getBusinesses(params?: {
    search?: string;
    category?: string;
    city?: string;
    area?: string;
    compound_id?: number;
    skip?: number;
    limit?: number;
  }): Promise<BusinessDirectoryResponse> {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    const suffix = query.toString();
    return this.request<BusinessDirectoryResponse>(`/api/businesses${suffix ? `?${suffix}` : ""}`);
  }

  async getBusiness(slug: string): Promise<BusinessDetail> {
    return this.request<BusinessDetail>(`/api/businesses/${encodeURIComponent(slug)}`);
  }

  async createBusiness(data: BusinessCreate): Promise<BusinessDetail> {
    return this.request<BusinessDetail>("/api/businesses", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async createBusinessOffer(slug: string, data: BusinessOfferCreate): Promise<BusinessOffer> {
    return this.request<BusinessOffer>(`/api/businesses/${encodeURIComponent(slug)}/offers`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateBusinessOffer(
    slug: string,
    offerId: number,
    data: BusinessOfferUpdate,
  ): Promise<BusinessOffer> {
    return this.request<BusinessOffer>(
      `/api/businesses/${encodeURIComponent(slug)}/offers/${offerId}`,
      { method: "PATCH", body: JSON.stringify(data) },
    );
  }

  async deleteBusinessOffer(slug: string, offerId: number): Promise<void> {
    await this.request(`/api/businesses/${encodeURIComponent(slug)}/offers/${offerId}`, {
      method: "DELETE",
    });
  }

  async trackBusinessOfferClick(offerId: number): Promise<void> {
    await this.request(`/api/businesses/offers/${offerId}/click`, { method: "POST" });
  }

  async getBusinessAnalytics(slug: string): Promise<BusinessAnalytics> {
    return this.request<BusinessAnalytics>(
      `/api/businesses/${encodeURIComponent(slug)}/analytics`,
    );
  }

  async createAdminBusiness(data: BusinessCreate): Promise<BusinessDetail> {
    return this.request<BusinessDetail>("/api/admin/businesses", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async submitBusinessClaim(
    businessId: number,
    data: BusinessClaimCreate,
  ): Promise<BusinessClaim> {
    return this.request<BusinessClaim>(`/api/businesses/${businessId}/claims`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getMyBusinessClaims(): Promise<BusinessClaim[]> {
    return this.request<BusinessClaim[]>("/api/business-claims/me");
  }

  async getBusinessMemberships(businessId: number): Promise<BusinessMembership[]> {
    return this.request<BusinessMembership[]>(`/api/businesses/${businessId}/memberships`);
  }

  async setBusinessMembership(
    businessId: number,
    userId: number,
    role: BusinessMembership["role"],
  ): Promise<BusinessMembership> {
    return this.request<BusinessMembership>(`/api/admin/businesses/${businessId}/memberships`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, role }),
    });
  }

  async deleteBusinessMembership(businessId: number, userId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/api/admin/businesses/${businessId}/memberships/${userId}`,
      { method: "DELETE" },
    );
  }

  async getAdminBusinesses(params?: {
    search?: string;
    status?: string;
    skip?: number;
    limit?: number;
  }): Promise<BusinessDirectoryResponse> {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    const suffix = query.toString();
    return this.request<BusinessDirectoryResponse>(`/api/admin/businesses${suffix ? `?${suffix}` : ""}`);
  }

  async updateAdminBusiness(id: number, data: AdminBusinessUpdate): Promise<BusinessDetail> {
    return this.request<BusinessDetail>(`/api/admin/businesses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getAdminBusinessClaims(status?: string): Promise<{
    items: BusinessClaim[];
    total: number;
    skip: number;
    limit: number;
  }> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request(`/api/admin/businesses/claims${query}`);
  }

  async reviewBusinessClaim(id: number, data: BusinessClaimReview): Promise<BusinessClaim> {
    return this.request<BusinessClaim>(
      `/api/admin/businesses/claims/${id}/${data.status === "APPROVED" ? "approve" : "reject"}`,
      {
        method: "POST",
        body: JSON.stringify({
          review_notes: data.review_notes,
          membership_role: data.membership_role,
        }),
      },
    );
  }

  async createAdminFeatureFlag(data: FeatureFlag): Promise<FeatureFlag> {
    return this.request<FeatureFlag>("/api/admin/feature-flags", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Generic reports
  async createReport(
    entityType: ReportEntityType,
    entityId: number,
    data: Omit<ReportCreate, "reported_type" | "reported_id">,
  ): Promise<ReportResponse> {
    return this.request<ReportResponse>("/api/reports", {
      method: "POST",
      body: JSON.stringify({ ...data, reported_type: entityType, reported_id: entityId }),
    });
  }

  async updateReport(reportId: number, data: ReportUpdate): Promise<ReportResponse> {
    return this.request<ReportResponse>(`/api/reports/${reportId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getReports(params?: {
    status_filter?: ReportResponse["status"];
    reported_type?: ReportEntityType;
    skip?: number;
    limit?: number;
  }): Promise<ReportResponse[]> {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined) query.set(key, String(value));
    });
    const suffix = query.toString();
    return this.request<ReportResponse[]>(`/api/reports${suffix ? `?${suffix}` : ""}`);
  }

  // Preferences and account deletion
  async getUserPreferences(): Promise<UserPreferences> {
    return this.request<UserPreferences>("/api/auth/me/preferences");
  }

  async updateUserPreferences(data: UserPreferencesUpdate): Promise<UserPreferences> {
    return this.request<UserPreferences>("/api/auth/me/preferences", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getPublicUserProfile(userId: number): Promise<PublicUserProfile> {
    return this.request<PublicUserProfile>(`/api/users/${userId}/profile`);
  }

  async requestAccountDeletion(
    data: AccountDeletionRequestCreate,
  ): Promise<AccountDeletionRequest> {
    return this.request<AccountDeletionRequest>("/api/auth/me/deletion-request", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getAccountDeletionRequest(): Promise<AccountDeletionRequest | null> {
    return this.request<AccountDeletionRequest | null>("/api/auth/me/deletion-request");
  }

  // Rollout configuration
  async getPublicFeatureConfig(): Promise<FeatureConfig> {
    return this.request<FeatureConfig>("/api/config/public", { skipAuthRefresh: true });
  }

  async getMyFeatureConfig(): Promise<FeatureConfig> {
    return this.request<FeatureConfig>("/api/config/me");
  }

  async getAdminFeatureFlags(): Promise<FeatureFlag[]> {
    return this.request<FeatureFlag[]>("/api/admin/feature-flags");
  }

  async updateAdminFeatureFlag(
    key: string,
    data: FeatureFlagUpdate,
  ): Promise<FeatureFlag> {
    return this.request<FeatureFlag>(`/api/admin/feature-flags/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async createFeatureFlagOverride(
    data: FeatureFlagOverride & { key: FeatureFlagKey },
  ): Promise<FeatureFlagOverride> {
    return this.request<FeatureFlagOverride>(`/api/admin/feature-flags/${encodeURIComponent(data.key)}/overrides`, {
      method: "POST",
      body: JSON.stringify({
        scope: data.scope,
        enabled: data.enabled,
        user_id: data.user_id,
        compound_id: data.compound_id,
        city: data.city,
        config: data.config,
      }),
    });
  }

  async getFeatureFlagOverrides(key: string): Promise<FeatureFlagOverride[]> {
    return this.request<FeatureFlagOverride[]>(`/api/admin/feature-flags/${encodeURIComponent(key)}/overrides`);
  }

  async deleteFeatureFlagOverride(key: string, id: number): Promise<void> {
    return this.request<void>(`/api/admin/feature-flags/${encodeURIComponent(key)}/overrides/${id}`, {
      method: "DELETE",
    });
  }

  // Privacy-safe first-party telemetry
  async sendAnalyticsEvents(batch: AnalyticsEventBatch): Promise<{ accepted: number }> {
    return this.request<{ accepted: number }>("/api/telemetry/events", {
      method: "POST",
      body: JSON.stringify(batch),
      skipAuthRefresh: true,
    });
  }

  async reportClientError(report: ClientErrorReport): Promise<{ accepted: boolean }> {
    return this.request<{ accepted: boolean }>("/api/telemetry/errors", {
      method: "POST",
      body: JSON.stringify(report),
      skipAuthRefresh: true,
    });
  }

  async getLatestDigest(): Promise<DigestSummary | null> {
    return this.request<DigestSummary | null>("/api/digests/me/latest");
  }

  // Eljiran beta operations
  async getAdminBetaMetrics(params?: {
    date_from?: string;
    date_to?: string;
  }): Promise<AdminBetaMetrics> {
    const query = new URLSearchParams();
    if (params?.date_from) query.set("date_from", params.date_from);
    if (params?.date_to) query.set("date_to", params.date_to);
    const suffix = query.toString();
    return this.request<AdminBetaMetrics>(`/api/admin/beta-metrics${suffix ? `?${suffix}` : ""}`);
  }

  async getAdminAuditLog(params?: {
    event_type?: string;
    entity_type?: string;
    entity_id?: string;
    actor_id?: number;
    skip?: number;
    limit?: number;
  }): Promise<AdminAuditList> {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    const suffix = query.toString();
    return this.request<AdminAuditList>(`/api/admin/audit-logs${suffix ? `?${suffix}` : ""}`);
  }
}

