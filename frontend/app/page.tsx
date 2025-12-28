import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Welcome to Hoodna.io
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Your verified neighborhood community and marketplace. Connect with your compound neighbors, buy, sell, and rent safely.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth/signup">
              <Button size="lg">Get Started</Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline">Sign In</Button>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-3">Verified Community</h3>
            <p className="text-gray-600">
              All residents are verified with ID and residency documents for a safe, trusted community.
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-3">Compound Marketplace</h3>
            <p className="text-gray-600">
              Buy, sell, and rent within your compound or promote listings to reach a wider audience.
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-3">No Agents</h3>
            <p className="text-gray-600">
              Direct communication between verified residents. No middlemen, no fees (except promotions).
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

