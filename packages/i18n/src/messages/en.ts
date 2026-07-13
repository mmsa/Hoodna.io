export const en = {
  brand: {
    tagline: "Your neighbourhood",
    taglineLong: "Your neighbourhood, connected.",
    taglineAuth: "Sign in to reach the people and services around you.",
  },
  nav: {
    home: "Home",
    marketplace: "Marketplace",
    services: "Services",
    messages: "Messages",
    notifications: "Notifications",
    saved: "Saved",
    settings: "Settings",
    profile: "Profile",
    viewProfile: "View profile",
    market: "Market",
    search: "Search",
    logOut: "Log out",
    communityFeed: "Community Feed",
    createListing: "Create Listing",
    savedListings: "Saved Listings",
    verification: "Verification",
    allFeatures: "All Features",
    adminDashboard: "Admin Dashboard",
  },
  header: {
    searchPlaceholder: "Search listings, posts, neighbours…",
    mainNav: "Main navigation",
  },
  auth: {
    signInWithEmail: "Sign in with email",
    continueWithPhone: "Continue with phone",
    createAccount: "New here? Create an account",
    terms: "By continuing, you agree to our Terms of Service.",
    welcomeBack: "Welcome back",
    signIn: "Sign in",
    signUp: "Sign up",
    forgotPassword: "Forgot password?",
    welcomeTo: "Welcome to eljiran",
    pleaseSignIn: "Please sign in to access settings.",
  },
  settings: {
    title: "Settings",
    description: "Update your account and preferences.",
    profileSettings: "Profile settings",
    profileDescription: "Update your account information",
    fullName: "Full name",
    fullNamePlaceholder: "Your full name",
    email: "Email",
    emailCannotChange: "Email cannot be changed",
    phone: "Phone (optional)",
    phonePlaceholder: "+20 123 456 7890",
    save: "Save changes",
    cancel: "Cancel",
    saved: "Settings saved",
    savedDescription: "Your profile has been updated.",
    saveFailed: "Failed to save",
    saveFailedDescription: "Please try again.",
    language: "Language",
    languageDescription: "Choose your preferred app language",
    english: "English",
    arabic: "العربية",
    notifications: "Notifications",
    pushNotifications: "Push notifications",
    weeklyDigest: "Weekly digest",
    communityAnnouncements: "Community announcements",
    businessRecommendations: "Business recommendations",
    pushNotificationsDescription: "Activity and account updates",
    weeklyDigestDescription: "A summary of your neighbourhood",
    communityAnnouncementsDescription: "Important local notices",
    businessRecommendationsDescription: "Relevant nearby businesses",
    preferencesUnavailable: "Preferences are unavailable right now.",
    inviteNeighbours: "Invite neighbours",
    inviteNeighboursDescription: "Share your link and view invitation stats",
    phoneNumberPlaceholder: "Your phone number",
    deleteConfirmHint: "This requests permanent deletion. Type DELETE below to confirm.",
    deletePlaceholder: "DELETE",
    deleteReasonPlaceholder: "Reason (optional)",
    requestDeletion: "Request account deletion",
    requestReceived: "Request received",
    couldNotSubmit: "Could not submit request",
    accountDeletion: "Account deletion",
    deleteAccount: "Delete account",
    deletionPending: "Your account deletion request is pending.",
    couldNotSave: "Could not save",
    notificationNotChanged: "Your notification preference was not changed.",
    success: "Success",
    settingsSaved: "Settings saved successfully!",
    error: "Error",
    failedToSave: "Failed to save settings",
  },
  common: {
    loading: "Loading…",
    loadingCommunity: "Loading your community",
    save: "Save",
    cancel: "Cancel",
    back: "Back",
    retry: "Try again",
  },
};

type DeepStringMap<T> = {
  [K in keyof T]: T[K] extends object ? DeepStringMap<T[K]> : string;
};

export type MessageTree = DeepStringMap<typeof en>;

export type MessageKey = FlattenKeys<MessageTree>;

type FlattenKeys<T, Prefix extends string = ""> = T extends string
  ? Prefix extends ""
    ? never
    : Prefix
  : {
      [K in keyof T & string]: FlattenKeys<
        T[K],
        Prefix extends "" ? K : `${Prefix}.${K}`
      >;
    }[keyof T & string];
