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
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      const errorMessage = (error as { detail?: string }).detail || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
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

  // Compounds
  async getCompounds(params?: {
    area?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<Compound[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    return this.request<Compound[]>(`/api/compounds?${queryParams}`);
  }
}

