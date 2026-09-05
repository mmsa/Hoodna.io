import type { Metadata } from "next"
import Link from "next/link"

import { LegalPage } from "@/components/legal-page"
import { ELJIRAN_SUPPORT_EMAIL } from "@hoodna/shared"

export const metadata: Metadata = {
  title: "Privacy Policy | eljiran",
  description:
    "How eljiran collects, uses, and protects personal data for its verified neighbourhood community and marketplace in Egypt.",
  alternates: { canonical: "/privacy" },
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="This policy explains what personal information eljiran collects, how we use it, and the choices available to you."
      updated="12 August 2026"
    >
      <section className="space-y-3">
        <h2>1. Who we are</h2>
        <p>
          eljiran (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the eljiran mobile
          apps and website at{" "}
          <a href="https://eljiran.io">https://eljiran.io</a>. eljiran is a verified
          neighbourhood community and marketplace for residential compounds in Egypt.
        </p>
        <p>
          For privacy questions or requests, contact us at{" "}
          <a href={`mailto:${ELJIRAN_SUPPORT_EMAIL}`}>{ELJIRAN_SUPPORT_EMAIL}</a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2>2. Information we collect</h2>
        <p>Depending on how you use eljiran, we may collect:</p>
        <h3>Account and contact information</h3>
        <ul>
          <li>Name, phone number, and email address</li>
          <li>Login credentials and authentication data (including OTP verification)</li>
          <li>Compound or neighbourhood selection and related profile details</li>
        </ul>
        <h3>Verification documents</h3>
        <ul>
          <li>
            National ID images and residency or ownership documents you upload to verify
            that you live in or belong to a compound
          </li>
          <li>
            Related review metadata, such as verification status, reviewer notes, and
            decision history
          </li>
        </ul>
        <h3>User content</h3>
        <ul>
          <li>Posts, comments, messages, listings, photos, and business profile details</li>
          <li>Reports, support requests, and feedback you send us</li>
        </ul>
        <h3>Transactions</h3>
        <ul>
          <li>
            Information related to paid listing promotions and similar in-app purchases,
            processed by our payment provider (for example Stripe). We do not store full
            card numbers on eljiran servers.
          </li>
        </ul>
        <h3>Device and usage information</h3>
        <ul>
          <li>
            Device type, operating system, app version, approximate diagnostics, crash
            logs, and basic usage events needed to operate and improve the service
          </li>
          <li>
            IP address and security logs used to protect accounts and prevent abuse
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>3. How we use information</h2>
        <p>We use personal information to:</p>
        <ul>
          <li>Create and manage your account</li>
          <li>Verify residency and keep compound communities trusted</li>
          <li>Provide the community feed, marketplace, messaging, and related features</li>
          <li>Process promotions and payments</li>
          <li>Moderate content, investigate reports, and enforce our Terms of Service</li>
          <li>Send service messages such as verification updates, security alerts, and product notices</li>
          <li>Improve reliability, safety, and product quality</li>
          <li>Comply with legal obligations and respond to lawful requests</li>
        </ul>
        <p>
          We do not sell your personal information. We do not use your verification
          documents for advertising.
        </p>
      </section>

      <section className="space-y-3">
        <h2>4. Legal bases and necessity</h2>
        <p>
          We process personal data because it is needed to provide the eljiran service
          you request, to protect the security and integrity of compound communities, to
          comply with law, and, where appropriate, based on your consent (for example when
          you upload documents or photos).
        </p>
      </section>

      <section className="space-y-3">
        <h2>5. Sharing of information</h2>
        <p>We may share information with:</p>
        <ul>
          <li>
            <strong>Other users in your compound or promoted visibility context</strong>,
            such as your public profile details, posts, comments, listings, and messages
            you choose to send
          </li>
          <li>
            <strong>Service providers</strong> that help us host, store, process payments,
            send communications, or analyse reliability (under contractual safeguards)
          </li>
          <li>
            <strong>Moderators and admins</strong> who review verification documents,
            reports, and safety issues
          </li>
          <li>
            <strong>Authorities or professional advisors</strong> when required by law or
            necessary to protect rights, safety, or the integrity of the platform
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>6. Sensitive verification data</h2>
        <p>
          Identity and residency documents are collected only for verification and trust
          &amp; safety. Access is limited to authorised reviewers and systems needed for
          that purpose. You should upload only the documents requested and avoid including
          unnecessary personal information.
        </p>
      </section>

      <section className="space-y-3">
        <h2>7. Retention</h2>
        <p>
          We keep personal information for as long as your account is active and as needed
          to provide the service, resolve disputes, enforce agreements, maintain security
          logs, and meet legal or accounting requirements. Verification documents and
          related records may be retained for as long as reasonably necessary for trust and
          safety, fraud prevention, and compliance. When you request account deletion, we
          delete or anonymise personal data that is no longer required, subject to lawful
          retention needs.
        </p>
      </section>

      <section className="space-y-3">
        <h2>8. Your choices and rights</h2>
        <p>Depending on applicable law, you may be able to:</p>
        <ul>
          <li>Access or update account profile information in Settings</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your account and associated personal data</li>
          <li>Ask questions about how we process your information</li>
        </ul>
        <p>
          Follow the steps at{" "}
          <Link href="/delete-account">https://eljiran.io/delete-account</Link>, or submit
          a deletion request in the app or website settings. You can also email{" "}
          <a href={`mailto:${ELJIRAN_SUPPORT_EMAIL}`}>{ELJIRAN_SUPPORT_EMAIL}</a>. We may
          need to verify your identity before completing certain requests.
        </p>
      </section>

      <section className="space-y-3">
        <h2>9. Security</h2>
        <p>
          We use administrative, technical, and organisational measures designed to protect
          personal information. No method of transmission or storage is completely secure,
          so we cannot guarantee absolute security.
        </p>
      </section>

      <section className="space-y-3">
        <h2>10. Children</h2>
        <p>
          eljiran is intended for adults who can create an account and complete residency
          verification. We do not knowingly collect personal information from children. If
          you believe a child has provided personal information, contact us and we will
          take appropriate steps.
        </p>
      </section>

      <section className="space-y-3">
        <h2>11. International processing</h2>
        <p>
          eljiran is focused on users in Egypt. Our service providers may process data in
          other countries. Where we do so, we take steps intended to provide appropriate
          safeguards.
        </p>
      </section>

      <section className="space-y-3">
        <h2>12. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will post the updated
          version on this page and revise the &quot;Last updated&quot; date. Continued use
          of eljiran after changes become effective means you accept the updated policy.
        </p>
      </section>

      <section className="space-y-3">
        <h2>13. Contact</h2>
        <p>
          Privacy and data requests:{" "}
          <a href={`mailto:${ELJIRAN_SUPPORT_EMAIL}`}>{ELJIRAN_SUPPORT_EMAIL}</a>
          <br />
          Support: <Link href="/support">https://eljiran.io/support</Link>
          <br />
          Website: <a href="https://eljiran.io">https://eljiran.io</a>
        </p>
      </section>
    </LegalPage>
  )
}
