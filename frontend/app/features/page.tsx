"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Home,
  ShoppingBag,
  MessageCircle,
  Shield,
  User,
  FileText,
  Settings,
  TrendingUp,
  Bell,
  Users,
  MapPin,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function FeaturesPage() {
  const { isAuthenticated, isAdmin } = useAuth();

  const mainFeatures = [
    {
      icon: MessageCircle,
      title: "Community Feed",
      description: "Share posts, connect with neighbors, and see what's happening in your compound",
      link: "/feed",
      color: "bg-primary",
      iconClass: "text-primary-foreground",
    },
    {
      icon: ShoppingBag,
      title: "Marketplace",
      description: "Buy, sell, and rent items within your compound. Create listings and browse what's available",
      link: "/marketplace",
      color: "bg-secondary",
      iconClass: "text-primary",
    },
    {
      icon: FileText,
      title: "Verification",
      description: "Upload your ID and residency documents to get verified and access all features",
      link: "/verification",
      color: "bg-accent",
      iconClass: "text-accent-foreground",
    },
    {
      icon: User,
      title: "Profile",
      description: "View and edit your profile information, see your listings and posts",
      link: "/profile",
      color: "bg-secondary",
      iconClass: "text-primary",
    },
    {
      icon: Settings,
      title: "Settings",
      description: "Manage your account settings, notifications, and preferences",
      link: "/settings",
      color: "bg-primary",
      iconClass: "text-primary-foreground",
    },
  ];

  const adminFeatures = [
    {
      icon: Shield,
      title: "Admin Panel",
      description: "Review and verify user documents, manage compounds, and moderate content",
      link: "/admin/verifications",
      color: "bg-accent",
      iconClass: "text-accent-foreground",
    },
  ];

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary mb-4 shadow-lg">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            All Features
          </h1>
          <p className="text-gray-600 text-lg">
            Everything you can do on eljiran.io
          </p>
        </div>

        {/* Main Features */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Main Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mainFeatures.map((feature) => (
              <Link key={feature.title} href={feature.link}>
                <Card className="h-full hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer border-2 hover:border-primary/30">
                  <CardHeader>
                    <div
                      className={`mb-2 flex h-12 w-12 items-center justify-center rounded-lg ${feature.color}`}
                    >
                      <feature.icon className={`h-6 w-6 ${feature.iconClass}`} />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">{feature.description}</p>
                    <Button
                      variant="outline"
                      className="w-full group"
                      disabled={!isAuthenticated && feature.link !== "/feed"}
                    >
                      Go to {feature.title}
                      <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Admin Features */}
        {isAdmin && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Admin Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {adminFeatures.map((feature) => (
                <Link key={feature.title} href={feature.link}>
                  <Card className="h-full hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer border-2 border-red-200 hover:border-red-400">
                    <CardHeader>
                      <div
                        className={`mb-2 flex h-12 w-12 items-center justify-center rounded-lg ${feature.color}`}
                      >
                        <feature.icon className={`h-6 w-6 ${feature.iconClass}`} />
                      </div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 mb-4">{feature.description}</p>
                      <Button
                        variant="outline"
                        className="w-full group border-red-200 hover:bg-red-50"
                      >
                        Go to {feature.title}
                        <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/feed">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3"
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">View Feed</div>
                  <div className="text-xs text-gray-500">See community posts</div>
                </div>
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3"
              >
                <ShoppingBag className="mr-2 h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Browse Marketplace</div>
                  <div className="text-xs text-gray-500">Find items for sale</div>
                </div>
              </Button>
            </Link>
            <Link href="/marketplace/new">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3"
              >
                <TrendingUp className="mr-2 h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Create Listing</div>
                  <div className="text-xs text-gray-500">Sell something</div>
                </div>
              </Button>
            </Link>
            <Link href="/verification">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3"
              >
                <CheckCircle className="mr-2 h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Get Verified</div>
                  <div className="text-xs text-gray-500">Upload documents</div>
                </div>
              </Button>
            </Link>
          </div>
        </div>

        {/* Navigation Guide */}
        <div className="mt-12 bg-gradient-to-br from-secondary to-background rounded-lg p-6 border-2 border-border">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How to Navigate</h2>
          <div className="space-y-3 text-gray-700">
            <div className="flex items-start gap-3">
              <Home className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <strong>Header Navigation:</strong> Use the top navigation bar to quickly access Feed and Marketplace
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <strong>User Menu:</strong> Click your avatar (top right) to access Profile, Settings, Verification, and Admin Panel
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShoppingBag className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <strong>Marketplace:</strong> Browse listings, create new listings, or filter by category (Property, Car, Item, Service)
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MessageCircle className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <strong>Feed Tabs:</strong> On the Feed page, use tabs to filter between All content, Posts only, or Marketplace items
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

