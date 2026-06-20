import type { Metadata } from "next";
import LegalShell from "../LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy · invoxai.io",
  description:
    "Learn how invoxai.io collects, uses and protects your personal data as a seller or buyer on the platform.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="June 20, 2026">
      <div className="notice">
        This policy applies to the invoxai.io platform and all services operated
        by it. By accessing or using invoxai.io you acknowledge that you have read
        and understood this Privacy Policy and agree to the data practices described
        herein.
      </div>

      <h2>1. Who We Are</h2>
      <p>
        invoxai.io (&ldquo;invoxai&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;,
        &ldquo;our&rdquo;) is an India-based Software-as-a-Service platform that
        enables independent sellers, creators and businesses (&ldquo;Sellers&rdquo;)
        to create storefronts, course pages, booking pages, event pages, and other
        commerce pages, and that enables end-users (&ldquo;Buyers&rdquo;) to
        discover and purchase products and services through those pages. Our
        operations are based in India and this policy is framed in accordance with
        the Information Technology Act, 2000, the Information Technology (Reasonable
        Security Practices and Procedures and Sensitive Personal Data or Information)
        Rules, 2011, and, where applicable, the Digital Personal Data Protection Act,
        2023.
      </p>

      <h2>2. Information We Collect</h2>
      <p>
        We collect personal data in the following categories depending on how you
        interact with the platform:
      </p>
      <ul>
        <li>
          <strong>Account information:</strong> When you register as a Seller or
          Buyer, we collect your name, email address, phone number (optional), and
          any profile details you provide. Sellers may also provide business name,
          GST number, and bank/UPI details for payout configuration.
        </li>
        <li>
          <strong>Store and page content:</strong> Text, images, prices, product
          descriptions, course materials, booking schedules, and any other content
          you upload to your pages.
        </li>
        <li>
          <strong>Order and transaction data:</strong> Purchase history, order
          amounts, product identifiers, Buyer email addresses, payment gateway
          transaction IDs, and commission deduction records.
        </li>
        <li>
          <strong>Payment method information:</strong> We do not store full card
          numbers, CVVs, UPI PINs, or net-banking credentials. Payment processing
          is handled exclusively by your chosen payment gateway (Razorpay, Cashfree,
          Stripe, PayU, or PhonePe). We receive only confirmation tokens, order
          status codes, and transaction reference numbers from those gateways.
        </li>
        <li>
          <strong>Usage and analytics data:</strong> Page views, button clicks,
          session duration, device type, browser, operating system, IP address,
          country, referrer URL, UTM parameters, and other standard web analytics
          signals. This data is used in aggregate to improve the platform.
        </li>
        <li>
          <strong>Communications:</strong> Support messages, in-app feedback, and
          email correspondence you send to us.
        </li>
        <li>
          <strong>Cookies and local storage:</strong> Session tokens, theme
          preferences, and analytics identifiers. See Section 5 for details.
        </li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <p>We use the data we collect for the following purposes:</p>
      <ul>
        <li>
          To create and maintain your account, authenticate you, and provide access
          to the features you are entitled to under your subscription plan.
        </li>
        <li>
          To process and record orders placed through Seller storefronts, deliver
          purchase confirmations to Buyers, and deduct platform commissions from
          Seller wallets.
        </li>
        <li>
          To send transactional communications — OTP login codes, order confirmations,
          payment receipts, wallet low-balance alerts, and plan expiry notices — that
          are necessary for operating the service.
        </li>
        <li>
          To detect, investigate and prevent fraud, spam, abuse, and security
          incidents, and to enforce our Terms of Service.
        </li>
        <li>
          To comply with applicable Indian laws, regulations, and lawful orders from
          governmental or judicial authorities.
        </li>
        <li>
          To analyse aggregated usage trends, improve platform performance, and develop
          new features.
        </li>
        <li>
          With your separate consent, to send marketing or product-update
          communications. You may withdraw this consent at any time by clicking
          &ldquo;Unsubscribe&rdquo; in any such email or by emailing us.
        </li>
      </ul>

      <h2>4. Legal Bases for Processing</h2>
      <p>
        We process your personal data on the following legal bases:
      </p>
      <ul>
        <li>
          <strong>Contract performance:</strong> Processing necessary to provide the
          services you have subscribed to or purchased.
        </li>
        <li>
          <strong>Legitimate interests:</strong> Security monitoring, fraud
          prevention, platform analytics, and product improvement, where our
          interests do not override your fundamental rights.
        </li>
        <li>
          <strong>Legal obligation:</strong> Record-keeping required by Indian
          financial and tax laws.
        </li>
        <li>
          <strong>Consent:</strong> Marketing communications and optional analytics
          features, where you have given explicit consent.
        </li>
      </ul>

      <h2>5. Cookies and Tracking Technologies</h2>
      <p>
        invoxai uses the following types of cookies and similar technologies:
      </p>
      <ul>
        <li>
          <strong>Essential cookies:</strong> Required for login sessions, CSRF
          protection, and core platform functionality. These cannot be disabled
          without breaking the service.
        </li>
        <li>
          <strong>Preference cookies:</strong> Remember your chosen display theme
          (light/dark) and language settings.
        </li>
        <li>
          <strong>Analytics:</strong> We use privacy-respecting analytics to
          measure page performance and user flows in aggregate.
        </li>
        <li>
          <strong>Third-party pixels:</strong> Seller storefronts may load
          third-party tracking pixels (Meta Pixel, Google Ads, etc.) configured by
          the Seller. invoxai is not responsible for the data practices of those
          third-party services; please refer to their individual privacy policies.
        </li>
      </ul>
      <p>
        You may manage or disable non-essential cookies through your browser settings.
        Note that disabling essential cookies will impair platform functionality.
      </p>

      <h2>6. Sharing of Information</h2>
      <p>
        We do not sell, rent, or trade your personal data. We share data with third
        parties only in the following limited circumstances:
      </p>
      <ul>
        <li>
          <strong>Payment gateways:</strong> Order and Buyer details (name, email,
          amount) are transmitted to the Seller&apos;s connected payment gateway to
          process transactions. Each gateway operates under its own terms and privacy
          policy.
        </li>
        <li>
          <strong>Cloud and infrastructure providers:</strong> We use Supabase
          (PostgreSQL database) and cloud hosting providers to store and process
          platform data. These providers are contractually obligated to handle data
          securely and only on our instructions.
        </li>
        <li>
          <strong>Sellers and Buyers:</strong> When a Buyer completes a purchase,
          their name and email address are shared with the relevant Seller to enable
          order fulfilment (e.g., granting course access or confirming a booking).
        </li>
        <li>
          <strong>Email delivery services:</strong> We use third-party transactional
          email providers to deliver notifications and receipts. These providers
          receive recipient email addresses and message content solely for delivery
          purposes.
        </li>
        <li>
          <strong>Legal and regulatory:</strong> We may disclose data when required
          to do so by law, court order, or request from a competent governmental or
          regulatory authority in India.
        </li>
        <li>
          <strong>Business transfers:</strong> In the event of a merger, acquisition,
          or sale of all or substantially all of our assets, personal data may be
          transferred to the successor entity, subject to equivalent privacy
          protections.
        </li>
      </ul>

      <h2>7. Data Retention</h2>
      <p>
        We retain your account and transaction records for as long as your account
        is active and for 7 years following account closure, in compliance with
        Indian financial record-keeping and tax-audit requirements. Backup copies may
        be retained for a shorter supplemental period for disaster-recovery purposes.
      </p>
      <p>
        You may request deletion of personal data that is not required to be retained
        by law by contacting us at the address in Section 11. We will respond within
        30 days and confirm what data, if any, must be retained and why.
      </p>

      <h2>8. Security</h2>
      <p>
        We implement industry-standard technical and organisational measures to
        protect your data, including:
      </p>
      <ul>
        <li>TLS 1.2+ encryption for all data in transit.</li>
        <li>Encrypted storage for sensitive credentials and tokens.</li>
        <li>Role-based access controls limiting employee access to personal data.</li>
        <li>Regular dependency audits and security reviews.</li>
        <li>Automated anomaly detection for unusual account activity.</li>
      </ul>
      <p>
        No system is completely impenetrable. In the event of a data breach that
        is likely to result in significant harm to affected users, we will notify
        those users and the relevant authority as required by applicable law, within
        72 hours of becoming aware of the breach.
      </p>

      <h2>9. Your Rights</h2>
      <p>
        Subject to applicable law, you have the following rights with respect to
        your personal data:
      </p>
      <ul>
        <li>
          <strong>Access:</strong> Request a copy of the personal data we hold about
          you.
        </li>
        <li>
          <strong>Correction:</strong> Request correction of inaccurate or incomplete
          data. You can update most account details directly in your dashboard.
        </li>
        <li>
          <strong>Deletion:</strong> Request deletion of data we are not legally
          required to retain. We will action deletion requests within 30 days.
        </li>
        <li>
          <strong>Portability:</strong> Request a machine-readable export of your
          personal data in a commonly used format.
        </li>
        <li>
          <strong>Withdrawal of consent:</strong> Withdraw consent for optional
          processing (such as marketing emails) at any time without affecting the
          lawfulness of prior processing.
        </li>
        <li>
          <strong>Grievance redressal:</strong> Lodge a grievance with our designated
          data protection contact listed in Section 11.
        </li>
      </ul>

      <h2>10. Children&apos;s Privacy</h2>
      <p>
        invoxai is not directed at individuals under 18 years of age. We do not
        knowingly collect personal data from minors. If you believe a minor has
        provided us with personal data, please contact us immediately at the address
        below and we will delete such data promptly.
      </p>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time to reflect changes in
        our practices, platform features, or applicable law. Material changes will be
        communicated via email to registered Sellers and/or via a prominent notice on
        the platform at least 15 days before the changes take effect. Your continued
        use of invoxai after the effective date of a revised policy constitutes
        acceptance of those changes. We encourage you to review this page periodically.
      </p>

      <h2>12. Contact and Grievance Officer</h2>
      <p>
        For privacy-related queries, requests to exercise your rights, or to raise
        a grievance, please contact us:
      </p>
      <ul>
        <li>
          <strong>Email:</strong>{" "}
          <a href="mailto:iamdeep.mk@gmail.com">iamdeep.mk@gmail.com</a>
        </li>
        <li>
          <strong>Subject line:</strong> Privacy Request &mdash; [your registered email]
        </li>
        <li>
          <strong>Response time:</strong> We aim to respond within 30 days of
          receiving a verifiable request.
        </li>
      </ul>
      <p>
        You may also use the Help section inside your dashboard to submit a support
        ticket.
      </p>
    </LegalShell>
  );
}
