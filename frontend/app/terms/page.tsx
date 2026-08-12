import type { Metadata } from "next"
import Link from "next/link"

import { LegalPage } from "@/components/legal-page"
import { ELJIRAN_SUPPORT_EMAIL } from "@hoodna/shared"

export const metadata: Metadata = {
  title: "Terms of Service | eljiran",
  description:
    "Terms governing use of the eljiran verified neighbourhood community and marketplace in Egypt.",
  alternates: { canonical: "/terms" },
}

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="These terms govern your access to and use of eljiran’s website, mobile apps, and related services."
      updated="12 August 2026"
    >
      <section className="space-y-3">
        <h2>1. Agreement</h2>
        <p>
          By creating an account or using eljiran, you agree to these Terms of Service and
          our <Link href="/privacy">Privacy Policy</Link>. If you do not agree, do not use
          the service.
        </p>
      </section>

      <section className="space-y-3">
        <h2>2. The service</h2>
        <p>
          eljiran is a verified neighbourhood community and marketplace for residential
          compounds in Egypt. Features may include compound selection, resident
          verification, community posts and comments, marketplace listings, messaging,
          business profiles, and paid listing promotions. Features may change, and
          availability may vary by compound or account status.
        </p>
      </section>

      <section className="space-y-3">
        <h2>3. Eligibility and accounts</h2>
        <ul>
          <li>You must be legally able to enter into these terms.</li>
          <li>You must provide accurate account information and keep it up to date.</li>
          <li>You are responsible for activity under your account and for protecting your login method.</li>
          <li>
            Some features require successful verification using identity and residency or
            ownership documents.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>4. Verification</h2>
        <p>
          Verification helps keep compound communities trusted. Submitting documents does
          not guarantee approval. We may approve, reject, request more information,
          suspend, or revoke verification when we reasonably believe it is necessary for
          safety, authenticity, or compliance. Providing false, misleading, or someone
          else’s documents is prohibited.
        </p>
      </section>

      <section className="space-y-3">
        <h2>5. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Harass, threaten, defraud, or harm others</li>
          <li>Post illegal, deceptive, discriminatory, or infringing content</li>
          <li>Impersonate another person or misrepresent your residency or identity</li>
          <li>Scrape, abuse, reverse engineer, or disrupt the service</li>
          <li>Use eljiran for spam, unauthorised advertising, or prohibited commercial activity</li>
          <li>Attempt to bypass verification, moderation, payments, or security controls</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>6. User content</h2>
        <p>
          You retain ownership of content you post. You grant eljiran a worldwide,
          non-exclusive, royalty-free licence to host, store, reproduce, display, and
          distribute that content as needed to operate and promote the service. You are
          responsible for the content you share and for having the rights to share it.
        </p>
        <p>
          We may remove or restrict content that violates these terms, applicable law, or
          compound community standards, and we may preserve content when needed for safety,
          legal, or operational reasons.
        </p>
      </section>

      <section className="space-y-3">
        <h2>7. Marketplace and transactions</h2>
        <p>
          Listings and communications between neighbours are generally between users.
          Unless we expressly state otherwise, eljiran is not a party to sale, rental, or
          service arrangements between users, does not guarantee listing accuracy, and is
          not responsible for user-to-user disputes, payments outside our paid promotion
          checkout, delivery, or product condition.
        </p>
      </section>

      <section className="space-y-3">
        <h2>8. Paid promotions and fees</h2>
        <p>
          Some features, such as listing promotions, may require payment. Prices and
          availability will be shown before you pay. Payment processing is handled by
          third-party providers. Fees are generally non-refundable except where required by
          law or expressly stated by us.
        </p>
      </section>

      <section className="space-y-3">
        <h2>9. Intellectual property</h2>
        <p>
          The eljiran name, branding, software, and service design are owned by us or our
          licensors. You may not copy, modify, or redistribute them except as allowed by
          these terms or with our prior written permission.
        </p>
      </section>

      <section className="space-y-3">
        <h2>10. Suspension and termination</h2>
        <p>
          You may stop using eljiran at any time and may request account deletion through
          the product or by contacting support. We may suspend or terminate access if you
          violate these terms, create risk, fail verification requirements, or if we
          discontinue the service.
        </p>
      </section>

      <section className="space-y-3">
        <h2>11. Disclaimers</h2>
        <p>
          eljiran is provided on an &quot;as is&quot; and &quot;as available&quot; basis.
          To the fullest extent permitted by law, we disclaim warranties of merchantability,
          fitness for a particular purpose, and non-infringement. We do not warrant that
          the service will be uninterrupted, secure, or error-free.
        </p>
      </section>

      <section className="space-y-3">
        <h2>12. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, eljiran and its operators will not be
          liable for indirect, incidental, special, consequential, or punitive damages, or
          for lost profits, data, or goodwill, arising from your use of the service. Our
          total liability for any claim relating to the service is limited to the greater
          of the amounts you paid to eljiran for the service in the 12 months before the
          claim or USD 50, except where liability cannot be limited by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2>13. Indemnity</h2>
        <p>
          You agree to defend and indemnify eljiran from claims arising out of your
          content, your use of the service, or your violation of these terms or applicable
          law.
        </p>
      </section>

      <section className="space-y-3">
        <h2>14. Governing law</h2>
        <p>
          These terms are governed by the laws of Egypt, without regard to conflict-of-law
          rules, except where mandatory consumer protections apply.
        </p>
      </section>

      <section className="space-y-3">
        <h2>15. Changes</h2>
        <p>
          We may update these terms from time to time. We will post the updated version on
          this page and revise the &quot;Last updated&quot; date. Continued use after
          changes become effective constitutes acceptance of the updated terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2>16. Contact</h2>
        <p>
          Questions about these terms:{" "}
          <a href={`mailto:${ELJIRAN_SUPPORT_EMAIL}`}>{ELJIRAN_SUPPORT_EMAIL}</a>
          <br />
          Support: <Link href="/support">https://eljiran.io/support</Link>
        </p>
      </section>
    </LegalPage>
  )
}
