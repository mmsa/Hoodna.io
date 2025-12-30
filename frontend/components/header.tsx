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
import { NotificationsDropdown } from './notifications-dropdown'
import Cookies from 'js-cookie'
import { useToast } from '@/hooks/use-toast'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading, isAdmin } = useAuth()
  const { toast } = useToast()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by only rendering auth-dependent content after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch unread messages count
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
    enabled: mounted && isAuthenticated,
    refetchInterval: 30000, // Poll every 30 seconds
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
    enabled: mounted && isAuthenticated,
  })

  const savedCount = savedListings?.length || 0

  // Fetch compound details if user has compound_id
  const { data: compound } = useQuery<{ id: number; name: string; area?: string }>({
    queryKey: ['compound', user?.compound_id],
    queryFn: async () => {
      if (!user?.compound_id) return null
      const response = await api.get(`/api/compounds?limit=200`)
      const compounds = response.data.items || []
      const foundCompound = compounds.find((c: any) => c.id === user.compound_id)
      return foundCompound || null
    },
    enabled: mounted && isAuthenticated && !!user?.compound_id,
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

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                eljiran.com
              </span>
              {compound && mounted && isAuthenticated && (
                <CompoundSwitcher currentCompound={compound} />
              )}
            </div>
          </Link>

          {/* Desktop Navigation */}
          {mounted && isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1">
              <Link href="/search">
                <Button
                  variant={isActive('/search') ? 'default' : 'ghost'}
                  className={isActive('/search') ? 'bg-blue-50 text-blue-700' : ''}
                  size="icon"
                >
                  <Search className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/feed">
                <Button
                  variant={isActive('/feed') ? 'default' : 'ghost'}
                  className={isActive('/feed') ? 'bg-blue-50 text-blue-700' : ''}
                >
                  <Home className="w-4 h-4 mr-2" />
                  Feed
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button
                  variant={isActive('/marketplace') ? 'default' : 'ghost'}
                  className={isActive('/marketplace') ? 'bg-blue-50 text-blue-700' : ''}
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Marketplace
                </Button>
              </Link>
              <Link href="/services">
                <Button
                  variant={isActive('/services') ? 'default' : 'ghost'}
                  className={isActive('/services') ? 'bg-green-50 text-green-700' : ''}
                >
                  <Wrench className="w-4 h-4 mr-2" />
                  Services
                </Button>
              </Link>
              <Link href="/marketplace/new">
                <Button
                  variant="ghost"
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Create Listing
                </Button>
              </Link>
              {isAdmin && (
                <Link href="/admin/verifications">
                  <Button
                    variant={isActive('/admin') ? 'default' : 'ghost'}
                    className={isActive('/admin') ? 'bg-blue-50 text-blue-700' : ''}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Admin
                  </Button>
                </Link>
              )}
            </nav>
          )}

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {!mounted || isLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : isAuthenticated && user ? (
              <>
                {/* Messages Button */}
                <Link href="/messages">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-10 w-10"
                  >
                    <MessageCircle className="h-5 w-5" />
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
                    className="relative h-10 w-10"
                  >
                    <Bookmark className="h-5 w-5" />
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
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
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
                              {compound.name}
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
                      <Link href="/saved" className="flex items-center">
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
                          <Link href="/admin/verifications" className="flex items-center">
                            <Shield className="mr-2 h-4 w-4" />
                            <span>Admin Panel</span>
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
                <Link href="/auth/signup">
                  <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                    Sign Up
                  </Button>
                </Link>
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
                className="w-full justify-start bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
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
              <Link href="/admin/verifications" onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant={isActive('/admin') ? 'default' : 'ghost'}
                  className="w-full justify-start"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Panel
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
  
  const { data: availableCompounds, isLoading } = useQuery<Array<{ id: number; name: string; area: string | null; is_current: boolean }>>({
    queryKey: ['user-compounds'],
    queryFn: async () => {
      const response = await api.get('/api/auth/me/compounds')
      return response.data
    },
    enabled: !!user,
  })

  const handleSwitch = async (compoundId: number) => {
    if (compoundId === user?.compound_id) return
    
    try {
      await api.post('/api/auth/me/switch-compound', { compound_id: compoundId })
      await refreshUser()
      toast({
        title: "Compound switched",
        description: "Your active compound has been updated.",
      })
      // Refresh the page to update all compound-specific data
      router.refresh()
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || "Failed to switch compound"
      
      // If user is not verified for this compound, redirect to verification
      if (errorMessage.includes("not verified") || error.response?.status === 403) {
        toast({
          title: "Verification Required",
          description: "You need to submit verification documents for this compound.",
          variant: "destructive",
        })
        router.push('/verification')
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    }
  }

  if (isLoading) {
    // Show simple display while loading
    return (
      <div className="flex items-center gap-1">
        <Building2 className="w-3 h-3 text-blue-600" />
        <span className="text-xs text-blue-600 font-medium">
          {currentCompound.name}
        </span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer">
          <Building2 className="w-3 h-3 text-blue-600" />
          <span className="text-xs text-blue-600 font-medium">
            {currentCompound.name}
          </span>
          <Building2 className="w-2 h-2 text-blue-600 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch Compound</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableCompounds && availableCompounds.length > 0 ? (
          availableCompounds.map((compound) => (
            <DropdownMenuItem
              key={compound.id}
              onClick={() => handleSwitch(compound.id)}
              className={compound.is_current ? "bg-blue-50" : ""}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col">
                  <span className={compound.is_current ? "font-semibold text-blue-700" : ""}>
                    {compound.name}
                  </span>
                  {compound.area && (
                    <span className="text-xs text-gray-500">{compound.area}</span>
                  )}
                </div>
                {compound.is_current && (
                  <Building2 className="w-4 h-4 text-blue-600" />
                )}
              </div>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>
            <div className="flex flex-col w-full">
              <span className="text-sm text-gray-600">No verified compounds</span>
              <span className="text-xs text-gray-500 mt-1">Submit verification documents to access compounds</span>
            </div>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            router.push('/onboarding/compound-select')
          }}
          className="text-blue-600 font-medium"
        >
          <Building2 className="w-4 h-4 mr-2" />
          Request Access to New Compound
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

