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
} from 'lucide-react'
import Cookies from 'js-cookie'
import { useToast } from '@/hooks/use-toast'
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
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Hoodna.io
            </span>
          </Link>

          {/* Desktop Navigation */}
          {mounted && isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1">
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
                {/* User Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
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
            <Link href="/marketplace" onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant={isActive('/marketplace') ? 'default' : 'ghost'}
                className="w-full justify-start"
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Marketplace
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

