import type { Metadata } from "next"
import Link from "next/link"

import { LegalPage } from "@/components/legal-page"
import { ELJIRAN_SUPPORT_EMAIL } from "@hoodna/shared"

export const metadata: Metadata = {
  title: "Delete your eljiran account | eljiran",
  description:
    "How to request deletion of your eljiran account and associated data, and what we delete or retain.",
  alternates: { canonical: "/delete-account" },
}

export default function DeleteAccountPage() {
  return (
    <LegalPage
      title="Delete your eljiran account"
      description="This page explains how users of the eljiran app and website can request that their account and associated personal data are deleted."
      updated="5 September 2026"
    >
      <section className="space-y-3">
        <h2>Request deletion in the eljiran app</h2>
        <ol className="list-decimal space-y-2 ps-5">
          <li>Open the eljiran app and sign in.</li>
          <li>Go to Profile, then Settings.</li>
          <li>Open the Delete account section.</li>
          <li>Type DELETE to confirm and submit the request.</li>
        </ol>
        <p>
          You can also sign in at{" "}
          <a href="https://eljiran.io">https://eljiran.io</a>, open Settings, and submit
          the same deletion request.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Request deletion by email</h2>
        <p>
          If you cannot sign in, email{" "}
          <a href={`mailto:${ELJIRAN_SUPPORT_EMAIL}`}>{ELJIRAN_SUPPORT_EMAIL}</a> from the
          phone number or email on your eljiran account. Include:
        </p>
        <ul>
          <li>The subject line: eljiran account deletion request</li>
          <li>The phone number and email on the account</li>
          <li>Your compound name, if you remember it</li>
        </ul>
        <p>
          We may ask you to confirm ownership before we process the request. We aim to
          complete deletion within 30 days of verifying the request, unless a longer period
          is required by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2>What we delete</h2>
        <p>After a verified deletion request, we delete or anonymise:</p>
        <ul>
          <li>Your account profile (name, phone number, email, and login credentials)</li>
          <li>Verification documents you uploaded (for example National ID and residency files)</li>
          <li>Your posts, comments, messages, listing photos, and similar content tied to your account</li>
          <li>Device tokens and app diagnostics linked to your account</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>What we may keep, and for how long</h2>
        <p>
          We may retain limited records when needed for security, fraud prevention, dispute
          handling, legal compliance, or accounting. Examples include:
        </p>
        <ul>
          <li>
            Payment or promotion records processed by our payment provider, kept as required
            for tax and accounting
          </li>
          <li>
            Security, abuse, or moderation logs needed to protect other residents, typically
            for up to 12 months unless a longer legal hold applies
          </li>
          <li>
            Information we must keep to comply with a lawful request or ongoing
            investigation, until that obligation ends
          </li>
        </ul>
        <p>
          Content you posted that other residents still need for an ongoing conversation
          (for example a reply in a thread) may be anonymised rather than removed entirely.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Related policies</h2>
        <ul>
          <li>
            <Link href="/privacy">Privacy Policy</Link>
          </li>
          <li>
            <Link href="/support">Support</Link>
          </li>
          <li>
            <Link href="/terms">Terms of Service</Link>
          </li>
        </ul>
      </section>
    </LegalPage>
  )
}
