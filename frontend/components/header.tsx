'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  User,
  LogOut,
  Settings,
  Home,
  ShoppingBag,
  Shield,
  Menu,
  X,
  FileText,
  Bookmark,
  PlusCircle,
  MessageCircle,
  Bell,
  Building2,
  Wrench,
  Search,
} from 'lucide-react'
import Image from 'next/image'
import { NotificationsDropdown } from './notifications-dropdown'
import Cookies from 'js-cookie'
import { useToast } from '@/hooks/use-toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { formatCompoundName, formatCompoundWithArea } from '@/lib/format-compound'
import { useFeatureConfig } from '@/components/feature-config-provider'
import { Avatar } from '@/components/ui/avatar'

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading, isAdmin } = useAuth()
  const { toast } = useToast()
  const { isEnabled } = useFeatureConfig()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by only rendering auth-dependent content after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const isApproved =
    !!user &&
    (user.role === 'ADMIN' ||
      user.role === 'MODERATOR' ||
      user.role === 'SERVICE_PROVIDER' ||
      user.role === 'COMPOUND_MOD' ||
      user.status === 'APPROVED')

  // Fetch unread messages count — only for approved / non-resident-gated roles
  const { data: conversations } = useQuery<Array<{ unread_count: number }>>({
    queryKey: ['conversations'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/conversations')
        return response.data || []
      } catch {
        return []
      }
    },
    enabled: mounted && isAuthenticated && isApproved,
    refetchInterval: 30000,
  })

  const unreadMessagesCount = conversations?.reduce((sum, conv) => sum + (conv.unread_count || 0), 0) || 0

  // Fetch saved listings count
  const { data: savedListings } = useQuery<Array<{ id: number }>>({
    queryKey: ['saved-listings'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/saved-listings')
        return response.data || []
      } catch {
        return []
      }
    },
    enabled: mounted && isAuthenticated && isApproved,
  })

  const savedCount = savedListings?.length || 0

  // Fetch compound details if user has compound_id
  // BUT: Skip for service providers and moderators (they don't need compound_id)
  const { data: compound } = useQuery<{ id: number; name: string; area?: string }>({
    queryKey: ['compound', user?.compound_id],
    queryFn: async () => {
      if (!user?.compound_id) return null
      const response = await api.get(`/api/compounds?limit=200`)
      const compounds = response.data.items || []
      const foundCompound = compounds.find((c: any) => c.id === user.compound_id)
      return foundCompound || null
    },
    enabled:
      mounted &&
      isAuthenticated &&
      isApproved &&
      !!user?.compound_id &&
      user.role !== 'SERVICE_PROVIDER' &&
      user.role !== 'COMPOUND_MOD',
  })

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout')
    } catch (error) {
      // Continue with logout even if API call fails
    } finally {
      Cookies.remove('access_token')
      Cookies.remove('refresh_token')
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      })
      router.push('/auth/login')
    }
  }

  const isActive = (path: string) => pathname === path

  // Don't show header on auth pages
  if (pathname?.startsWith('/auth/')) {
    return null
  }

  const isUnapprovedResident =
    mounted &&
    isAuthenticated &&
    user &&
    (user.role === 'RESIDENT' || user.role === 'USER') &&
    user.status !== 'APPROVED'

  // Minimal header while verification is incomplete — no app navigation
  if (isUnapprovedResident) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
        <div className="eljiran-shell flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Image
              src="/icon_light.jpg"
              alt="eljiran.com"
              width={32}
              height={32}
              className="h-8 w-8 rounded-full"
            />
            <span className="text-base font-semibold text-foreground">eljiran.com</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-card/90 shadow-card backdrop-blur-md supports-[backdrop-filter]:bg-card/75">
      <div className="eljiran-shell px-4 sm:px-6">
        <div className="flex h-[4.25rem] items-center gap-4">
          {/* Logo */}
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/icon_light.jpg"
                alt="eljiran.com"
                width={40}
                height={40}
                className="h-10 w-10 rounded-full"
                priority
              />
              <span className="hidden text-lg font-bold tracking-tight text-primary sm:inline">eljiran</span>
            </Link>
            {compound && mounted && isAuthenticated && (
              <CompoundSwitcher currentCompound={compound} />
            )}
          </div>

          {/* Centre search — canvas spec */}
          {mounted && isAuthenticated && (
            <form
              className="hidden min-w-0 flex-1 md:block"
              onSubmit={(event) => {
                event.preventDefault()
                const form = event.currentTarget
                const input = form.elements.namedItem("header-search") as HTMLInputElement | null
                const query = input?.value?.trim()
                router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search")
              }}
            >
              <div className="relative mx-auto max-w-xl">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  name="header-search"
                  type="search"
                  placeholder="Search listings, posts, neighbours…"
                  className="eljiran-search w-full"
                />
              </div>
            </form>
          )}

          <div className="ml-auto flex items-center gap-2">
            {!mounted || isLoading ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
            ) : isAuthenticated && user ? (
              <>
                {/* Messages Button */}
                <Link href="/messages">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-10 w-10 rounded-full hover:bg-muted"
                  >
                    <MessageCircle className="h-5 w-5 text-muted-foreground" />
                    {unreadMessagesCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white">
                        {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                      </span>
                    )}
                  </Button>
                </Link>

                {/* Notifications Dropdown */}
                <NotificationsDropdown />

                {/* Saved Items Button */}
                <Link href="/saved-listings">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-10 w-10 rounded-full hover:bg-muted"
                  >
                    <Bookmark className="h-5 w-5 text-muted-foreground" />
                    {savedCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-yellow-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white">
                        {savedCount > 99 ? '99+' : savedCount}
                      </span>
                    )}
                  </Button>
                </Link>

                {/* User Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                      <Avatar name={user.name} size="md" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                        {compound && (
                          <div className="flex items-center gap-1 mt-1">
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                            <p className="text-xs leading-none text-muted-foreground">
                              {formatCompoundName(compound.name)}
                            </p>
                          </div>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/feed" className="flex items-center">
                        <Home className="mr-2 h-4 w-4" />
                        <span>Community Feed</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/marketplace" className="flex items-center">
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        <span>Marketplace</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/marketplace/new" className="flex items-center">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        <span>Create Listing</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/saved-listings" className="flex items-center">
                        <Bookmark className="mr-2 h-4 w-4" />
                        <span>Saved Listings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/messages" className="flex items-center">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        <span>Messages</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/notifications" className="flex items-center">
                        <Bell className="mr-2 h-4 w-4" />
                        <span>Notifications</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/verification" className="flex items-center">
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Verification</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/features" className="flex items-center">
                        <Home className="mr-2 h-4 w-4" />
                        <span>All Features</span>
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/admin/dashboard" className="flex items-center">
                            <Shield className="mr-2 h-4 w-4" />
                            <span>Admin Dashboard</span>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Mobile Menu Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/login">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                {isEnabled('user_registration') ? <Link href="/auth/signup">
                  <Button>
                    Sign Up
                  </Button>
                </Link> : null}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {mounted && mobileMenuOpen && isAuthenticated && (
          <div className="md:hidden border-t py-4 space-y-2 animate-fade-in">
            <Link href="/feed" onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant={isActive('/feed') ? 'default' : 'ghost'}
                className="w-full justify-start"
              >
                <Home className="w-4 h-4 mr-2" />
                Feed
              </Button>
            </Link>
            <Link href="/services" onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant={isActive('/services') ? 'default' : 'ghost'}
                className="w-full justify-start"
              >
                <Wrench className="w-4 h-4 mr-2" />
                Services
              </Button>
            </Link>
            <Link href="/marketplace" onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant={isActive('/marketplace') ? 'default' : 'ghost'}
                className="w-full justify-start"
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Marketplace
              </Button>
            </Link>
            <Link href="/businesses" onClick={() => setMobileMenuOpen(false)}>
              <Button variant={isActive('/businesses') ? 'default' : 'ghost'} className="w-full justify-start">
                <Building2 className="w-4 h-4 mr-2" />
                Businesses
              </Button>
            </Link>
            <Link href="/notifications" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start relative">
                <Bell className="w-4 h-4 mr-2" />
                Notifications
              </Button>
            </Link>
            <Link href="/messages" onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start relative"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Messages
                {unreadMessagesCount > 0 && (
                  <span className="ml-auto px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link href="/saved-listings" onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start relative"
              >
                <Bookmark className="w-4 h-4 mr-2" />
                Saved Items
                {savedCount > 0 && (
                  <span className="ml-auto px-2 py-0.5 bg-yellow-500 text-white text-xs font-bold rounded-full">
                    {savedCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link href="/marketplace/new" onClick={() => setMobileMenuOpen(false)}>
              <Button
                className="w-full justify-start"
                variant="whatsapp"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Create Listing
              </Button>
            </Link>
            <Link href="/verification" onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant={isActive('/verification') ? 'default' : 'ghost'}
                className="w-full justify-start"
              >
                <FileText className="w-4 h-4 mr-2" />
                Verification
              </Button>
            </Link>
            {isAdmin && (
              <Link href="/admin/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant={isActive('/admin') ? 'default' : 'ghost'}
                  className="w-full justify-start"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Dashboard
                </Button>
              </Link>
            )}
            <div className="pt-2 border-t">
              <Button
                variant="ghost"
                className="w-full justify-start text-red-600"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

// Compound Switcher Component
function CompoundSwitcher({ currentCompound }: { currentCompound: { id: number; name: string; area?: string } }) {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const { data: availableCompounds, isLoading } = useQuery<Array<{ id: number; name: string; area: string | null; is_current: boolean; is_verified: boolean }>>({
    queryKey: ['user-compounds'],
    queryFn: async () => {
      const response = await api.get('/api/auth/me/compounds')
      return (response.data || []).map((c: { is_verified?: boolean }) => ({
        ...c,
        is_verified: c.is_verified ?? true,
      }))
    },
    enabled: !!user,
  })

  const handleSwitch = async (compoundId: number, isVerified: boolean) => {
    if (compoundId === user?.compound_id) return
    
    try {
      await api.post('/api/auth/me/switch-compound', { compound_id: compoundId })
      await refreshUser()
      queryClient.invalidateQueries({ queryKey: ['user-compounds'] })
      queryClient.invalidateQueries({ queryKey: ['compound'] })
      if (isVerified) {
        toast({
          title: 'Neighbourhood switched',
          description: 'Your active neighbourhood has been updated.',
        })
        router.replace('/feed')
        router.refresh()
      } else {
        toast({
          title: 'Continue verification',
          description: 'Complete verification documents for this neighbourhood.',
        })
        router.push('/verification')
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to switch compound'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    // Show simple display while loading
    return (
      <div className="ml-2 flex items-center gap-1.5">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          {formatCompoundWithArea(currentCompound.name, currentCompound.area)}
        </span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex cursor-pointer items-center gap-1.5 transition-opacity hover:opacity-80">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {formatCompoundWithArea(currentCompound.name, currentCompound.area)}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch Neighbourhood</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableCompounds && availableCompounds.length > 0 ? (
          availableCompounds.map((compound) => (
            <DropdownMenuItem
              key={compound.id}
              onClick={() => handleSwitch(compound.id, compound.is_verified)}
              className={compound.is_current ? 'bg-muted' : ''}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <div className="flex flex-col min-w-0">
                  <span className={compound.is_current ? 'font-semibold text-foreground' : ''}>
                    {formatCompoundWithArea(compound.name, compound.area)}
                  </span>
                  <span
                    className={`mt-0.5 text-xs ${
                      compound.is_verified ? 'text-muted-foreground' : 'text-amber-700'
                    }`}
                  >
                    {compound.is_verified ? 'Verified' : 'Verification in progress'}
                  </span>
                </div>
                {compound.is_current && (
                  <Building2 className="h-4 w-4 shrink-0 text-primary" />
                )}
              </div>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>
            <div className="flex flex-col w-full">
              <span className="text-sm text-gray-600">No neighbourhoods yet</span>
              <span className="text-xs text-gray-500 mt-1">
                Request access and submit verification documents
              </span>
            </div>
          </DropdownMenuItem>
        )}
        {/* Only show compound switcher for residents, not service providers or moderators */}
        {(user?.role === 'RESIDENT' || user?.role === 'USER') && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                router.push('/onboarding/compound-select')
              }}
              className="font-medium text-primary"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Request Access to New Neighbourhood
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

