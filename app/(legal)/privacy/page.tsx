import type { Metadata } from "next";
import LegalShell from "../LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy · invoxai.io",
  description:
    "Learn how invoxai.io collects, uses and protects your personal data as a seller or buyer on the platform.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="19 June 2026">
      <div className="notice">
        This policy applies to the invoxai.io platform and all services operated
        by it. By using invoxai.io you agree to the practices described here.
      </div>

      <h2>1. Who We Are</h2>
      <p>
        invoxai.io ("invoxai", "we", "us", "our") is an India-based Software-as-a-Service
        platform that enables independent sellers, creators and businesses ("Sellers") to
        create storefronts, courses, booking pages, events and other commerce pages, and
        that enables buyers ("Buyers") to discover and purchase products and services
        through those pages. Our registered office is in India.
      </p>

      <h2>2. Information We Collect</h2>
      <p>We collect the following categories of personal data:</p>
      <ul>
        <li>
          <strong>Account information:</strong> email address, name and profile details you
          provide when signing up as a Seller or Buyer.
        </li>
        <li>
          <strong>Store and page content:</strong> text, images, pricing and other content
          you upload to your pages.
        </li>
        <li>
          <strong>Order and transaction data:</strong> purchase history, order amounts,
          product details and buyer email addresses associated with completed orders.
        </li>
        <li>
          <strong>Payment method information:</strong> we do not store full card numbers or
          banking credentials. Payment processing is handled by your chosen gateway
          (Razorpay, Cashfree, Stripe, PayU or PhonePe); we receive confirmation tokens and
          order identifiers from those gateways.
        </li>
        <li>
          <strong>Usage and analytics data:</strong> page views, click events, device type,
          browser, IP address, referrer URL and other standard web analytics signals.
        </li>
        <li>
          <strong>Communications:</strong> support messages, feedback and email
          correspondence you send us.
        </li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <p>We use collected data to:</p>
      <ul>
        <li>Provide, operate and improve the invoxai platform and its features.</li>
        <li>
          Process and record orders on behalf of Sellers and deliver purchase confirmations
          to Buyers.
        </li>
        <li>
          Send transactional emails (OTP login codes, order confirmations, receipts) and
          platform notifications.
        </li>
        <li>Detect fraud, abuse and security threats.</li>
        <li>Comply with applicable Indian laws and regulations.</li>
        <li>
          With your consent, send marketing or product-update communications (you may
          opt out at any time).
        </li>
      </ul>

      <h2>4. Sharing of Information</h2>
      <p>
        We do not sell your personal data. We may share data with third parties only in
        the following circumstances:
      </p>
      <ul>
        <li>
          <strong>Payment gateways:</strong> order and buyer details are passed to the
          Seller's connected payment gateway (e.g., Razorpay) to process transactions.
          Each gateway has its own privacy policy.
        </li>
        <li>
          <strong>Infrastructure providers:</strong> we use cloud infrastructure (including
          Supabase for our database) and may process data on servers located in India or
          other jurisdictions with adequate data-protection safeguards.
        </li>
        <li>
          <strong>Sellers and Buyers:</strong> when a Buyer makes a purchase, their name
          and email are shared with the relevant Seller so they can fulfil the order.
        </li>
        <li>
          <strong>Legal obligations:</strong> we may disclose information when required by
          law, court order or governmental authority.
        </li>
      </ul>

      <h2>5. Cookies and Tracking</h2>
      <p>
        invoxai uses cookies and similar technologies to maintain your session, remember
        theme preferences and measure page performance. Seller storefronts may also load
        third-party tracking pixels (Meta, Google Ads) configured by the Seller; invoxai
        is not responsible for those third-party data practices. You may disable cookies
        via your browser settings; some platform features may not function correctly if
        you do.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        We retain your account and transaction data for as long as your account is active
        and for a period of 7 years after account closure to comply with Indian financial
        record-keeping obligations. You may request deletion of personal data not required
        by law by contacting us at the address below.
      </p>

      <h2>7. Security</h2>
      <p>
        We implement industry-standard technical and organisational measures — including
        TLS encryption in transit, access controls and regular security reviews — to
        protect your data. No system is completely secure; in the event of a data breach
        we will notify affected users as required by applicable law.
      </p>

      <h2>8. Your Rights</h2>
      <p>
        Subject to applicable law, you have the right to access, correct or delete your
        personal data, and to withdraw consent to optional processing. To exercise these
        rights please email us at{" "}
        <a href="mailto:privacy@invoxai.io">privacy@invoxai.io</a>. We will respond within
        30 days.
      </p>

      <h2>9. Children</h2>
      <p>
        invoxai is not directed at children under 18. We do not knowingly collect personal
        data from minors. If you believe a minor has provided us data please contact us
        for prompt deletion.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be
        communicated via email or a prominent notice on the platform at least 15 days
        before they take effect. Continued use of invoxai after the effective date
        constitutes acceptance of the updated policy.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        For privacy-related queries, write to us at{" "}
        <a href="mailto:privacy@invoxai.io">privacy@invoxai.io</a> or use the Help section
        in your dashboard.
      </p>
    </LegalShell>
  );
}
