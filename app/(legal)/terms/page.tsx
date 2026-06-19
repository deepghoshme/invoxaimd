import type { Metadata } from "next";
import LegalShell from "../LegalShell";

export const metadata: Metadata = {
  title: "Terms of Service · invoxai.io",
  description:
    "Read the Terms of Service governing your use of invoxai.io as a Seller or Buyer.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="19 June 2026">
      <div className="notice">
        Please read these Terms carefully before using invoxai.io. By registering
        an account or purchasing through a storefront on this platform you agree
        to be bound by these Terms.
      </div>

      <h2>1. Definitions</h2>
      <p>
        <strong>"invoxai" / "Platform"</strong> means invoxai.io and all associated
        services, APIs and infrastructure operated by us.
        <br />
        <strong>"Seller"</strong> means any individual or business entity that registers
        an account to create pages, sell products or services, or collect payments through
        the Platform.
        <br />
        <strong>"Buyer"</strong> means any person who purchases a product or service
        through a Seller's storefront or page hosted on the Platform.
        <br />
        <strong>"Content"</strong> means any text, images, videos, descriptions, pricing
        and other material uploaded or published by a Seller.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years old and legally capable of entering into a binding
        contract under Indian law to use invoxai as a Seller. Buyers must be at least 18
        or have the consent of a parent or guardian. By using the Platform you represent
        and warrant that you meet these requirements.
      </p>

      <h2>3. Seller Accounts and Responsibilities</h2>
      <ul>
        <li>
          You are responsible for maintaining the confidentiality of your account
          credentials and for all activity that occurs under your account.
        </li>
        <li>
          You must provide accurate, current and complete information during registration
          and keep it up to date.
        </li>
        <li>
          You are solely responsible for all Content you publish, all products and
          services you offer, and the accuracy of your pricing, descriptions and delivery
          commitments.
        </li>
        <li>
          You must not list or sell illegal, counterfeit, hazardous, or prohibited goods
          or services. invoxai reserves the right to remove any Content and suspend any
          account that violates this rule, with or without prior notice.
        </li>
        <li>
          You are responsible for collecting and remitting applicable taxes (GST, TDS etc.)
          on your sales. invoxai does not provide tax advice.
        </li>
      </ul>

      <h2>4. Payment Processing</h2>
      <p>
        Sellers connect their own payment gateway accounts (Razorpay, Cashfree, Stripe,
        PayU or PhonePe). Payments from Buyers flow directly into the Seller's connected
        gateway account; invoxai does not hold Seller funds.
      </p>
      <p>
        invoxai charges a commission per completed sale based on the Seller's active plan
        (ranging from 1.5% to 6%). This commission is deducted from the Seller's
        pre-funded wallet on the Platform. Sellers must maintain a sufficient wallet
        balance; invoxai may suspend checkout on pages where the wallet balance is
        insufficient.
      </p>
      <p>
        All disputes between Buyers and Sellers regarding payment are to be resolved
        directly between those parties. invoxai is not a party to the transaction and is
        not responsible for payment failures, chargebacks or refund disputes.
      </p>

      <h2>5. Intellectual Property</h2>
      <p>
        Sellers retain ownership of their Content. By publishing Content on invoxai, you
        grant invoxai a non-exclusive, royalty-free, worldwide licence to host, display,
        cache and serve that Content for the purpose of operating the Platform.
      </p>
      <p>
        The invoxai name, logo, platform code and design are the exclusive property of
        invoxai and may not be reproduced or used without prior written permission.
      </p>

      <h2>6. Prohibited Conduct</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Platform for any unlawful purpose or in violation of any applicable law.</li>
        <li>Attempt to gain unauthorised access to any part of the Platform or to other users' accounts.</li>
        <li>Reverse-engineer, scrape or otherwise extract data from the Platform except as explicitly permitted.</li>
        <li>Transmit spam, malware, or any content that is defamatory, obscene or hateful.</li>
        <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity.</li>
      </ul>

      <h2>7. Disclaimers and Limitation of Liability</h2>
      <p>
        THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
        EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY OR FITNESS FOR A
        PARTICULAR PURPOSE. INVOXAI DOES NOT WARRANT THAT THE PLATFORM WILL BE
        UNINTERRUPTED, ERROR-FREE OR FREE OF SECURITY VULNERABILITIES.
      </p>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, INVOXAI SHALL NOT BE LIABLE FOR
        ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, INCLUDING LOSS
        OF PROFITS, DATA OR GOODWILL. INVOXAI'S TOTAL AGGREGATE LIABILITY TO ANY SELLER OR
        BUYER SHALL NOT EXCEED THE AMOUNT PAID BY THAT PARTY TO INVOXAI IN THE THREE MONTHS
        PRECEDING THE CLAIM.
      </p>

      <h2>8. Indemnification</h2>
      <p>
        You agree to indemnify and hold invoxai, its affiliates, officers and employees
        harmless from any claims, losses, damages or expenses (including reasonable legal
        fees) arising out of your use of the Platform, your Content, your products or
        services, or your violation of these Terms.
      </p>

      <h2>9. Suspension and Termination</h2>
      <p>
        invoxai may suspend or terminate your account at any time for violation of these
        Terms, fraudulent activity, or inactivity of more than 12 months, with or without
        prior notice. Sellers may delete their accounts at any time via the dashboard.
        Termination does not relieve you of any outstanding payment obligations.
      </p>

      <h2>10. Governing Law and Disputes</h2>
      <p>
        These Terms are governed by the laws of India. Any dispute arising out of or in
        connection with these Terms shall first be attempted to be resolved through
        good-faith negotiation. If unresolved, disputes shall be referred to binding
        arbitration under the Arbitration and Conciliation Act, 1996, with the seat of
        arbitration in Bengaluru, Karnataka, India. The language of arbitration shall be
        English.
      </p>

      <h2>11. Changes to Terms</h2>
      <p>
        We may modify these Terms at any time. We will provide at least 15 days' notice
        of material changes via email or prominent platform notice. Continued use after
        the effective date constitutes acceptance of the revised Terms.
      </p>

      <h2>12. Contact</h2>
      <p>
        For questions about these Terms, contact us at{" "}
        <a href="mailto:legal@invoxai.io">legal@invoxai.io</a>.
      </p>
    </LegalShell>
  );
}
