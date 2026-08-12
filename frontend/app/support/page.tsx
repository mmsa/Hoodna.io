import type { Metadata } from "next"
import Link from "next/link"

import { LegalPage } from "@/components/legal-page"
import { ELJIRAN_SUPPORT_EMAIL } from "@hoodna/shared"

export const metadata: Metadata = {
  title: "Support | eljiran",
  description: "Get help with your eljiran account, verification, listings, and privacy requests.",
  alternates: { canonical: "/support" },
}

export default function SupportPage() {
  return (
    <LegalPage
      title="Support"
      description="Need help with eljiran? Use the options below for account, verification, marketplace, and privacy support."
      updated="12 August 2026"
    >
      <section className="space-y-3">
        <h2>Contact us</h2>
        <p>
          Email{" "}
          <a href={`mailto:${ELJIRAN_SUPPORT_EMAIL}`}>{ELJIRAN_SUPPORT_EMAIL}</a> and
          include:
        </p>
        <ul>
          <li>The email or phone number on your account</li>
          <li>Your compound name, if relevant</li>
          <li>A short description of the issue</li>
          <li>Screenshots when they help explain the problem</li>
        </ul>
        <p>We aim to respond as quickly as we can during normal business hours in Egypt.</p>
      </section>

      <section className="space-y-3">
        <h2>Common topics</h2>
        <h3>Account and sign-in</h3>
        <p>
          If you cannot sign in, tell us the phone number or email you used and what error
          you see. For security, we may ask you to confirm account ownership before making
          changes.
        </p>
        <h3>Verification</h3>
        <p>
          Verification usually requires a National ID and a residency or ownership
          document. Make sure images are clear, complete, and match the account details.
          If your submission is rejected, check the reason in the app and resubmit with
          clearer documents if needed.
        </p>
        <h3>Listings and promotions</h3>
        <p>
          For listing or payment issues, include the listing title, approximate time of the
          problem, and any payment reference you received.
        </p>
        <h3>Safety and reporting</h3>
        <p>
          Use in-app reporting when available for abusive posts, scam listings, or
          suspicious behaviour. For urgent safety concerns, contact local authorities first,
          then email us with details.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Privacy and account deletion</h2>
        <p>
          You can review how we handle personal data in our{" "}
          <Link href="/privacy">Privacy Policy</Link>. To request account deletion, use
          the delete-account option in Settings when available, or email{" "}
          <a href={`mailto:${ELJIRAN_SUPPORT_EMAIL}`}>{ELJIRAN_SUPPORT_EMAIL}</a> from the
          address associated with your account.
        </p>
      </section>

      <section className="space-y-3">
        <h2>App Store / Play Store support URL</h2>
        <p>
          This page is the public support destination for eljiran:{" "}
          <a href="https://eljiran.io/support">https://eljiran.io/support</a>
        </p>
      </section>

      <section className="space-y-3">
        <h2>Policies</h2>
        <ul>
          <li>
            <Link href="/privacy">Privacy Policy</Link>
          </li>
          <li>
            <Link href="/terms">Terms of Service</Link>
          </li>
        </ul>
      </section>
    </LegalPage>
  )
}
