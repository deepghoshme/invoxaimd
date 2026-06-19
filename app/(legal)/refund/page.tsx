import type { Metadata } from "next";
import LegalShell from "../LegalShell";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy · invoxai.io",
  description:
    "Understand invoxai.io's refund and cancellation policy for Sellers (platform subscriptions and wallet) and Buyers (product purchases).",
};

export default function RefundPage() {
  return (
    <LegalShell title="Refund & Cancellation Policy" updated="19 June 2026">
      <div className="notice">
        This policy covers two distinct scenarios: (1) refunds to Sellers for
        platform fees paid to invoxai, and (2) refunds to Buyers for purchases
        made through a Seller's storefront.
      </div>

      <h2>Part A — Platform Fees (Sellers)</h2>

      <h2>A1. Subscription Plans</h2>
      <p>
        invoxai offers monthly and annual subscription plans (Starter, Growth, Scale).
        Subscriptions are billed in advance.
      </p>
      <ul>
        <li>
          <strong>Free plan (Starter):</strong> No charge, no refund applicable.
        </li>
        <li>
          <strong>Paid monthly plans:</strong> You may cancel your subscription at any
          time from the dashboard. Your plan remains active until the end of the current
          billing period. No pro-rata refund is issued for the unused portion of the
          billing period.
        </li>
        <li>
          <strong>Paid annual plans:</strong> Annual plans may be cancelled within 7 days
          of the initial purchase for a full refund, provided no more than 5 seller pages
          have been published under the plan in that period. After 7 days, no refund is
          issued for the remaining period; the plan continues until expiry.
        </li>
        <li>
          <strong>Duplicate charges:</strong> If you are charged twice for the same
          billing cycle due to a technical error, please contact us within 14 days and
          we will issue a full refund of the duplicate amount.
        </li>
      </ul>

      <h2>A2. Commission Wallet</h2>
      <p>
        Sellers pre-fund a commission wallet that is debited on each completed sale.
        Wallet top-ups are non-refundable under normal circumstances. However:
      </p>
      <ul>
        <li>
          If your account is closed and there is a positive wallet balance, we will refund
          the remaining balance to your original payment method within 10 business days,
          subject to a minimum balance of ₹50.
        </li>
        <li>
          Wallet credits issued as promotional bonuses are not refundable.
        </li>
      </ul>

      <h2>A3. How to Request a Platform Refund</h2>
      <p>
        Email <a href="mailto:billing@invoxai.io">billing@invoxai.io</a> with your
        registered email address, the transaction ID or invoice number, and the reason
        for your request. We aim to respond within 3 business days. Approved refunds are
        processed within 7–10 business days to the original payment instrument.
      </p>

      <h2>Part B — Product Purchases (Buyers)</h2>

      <h2>B1. General Principle</h2>
      <p>
        invoxai is a platform that hosts independent Seller storefronts. Buyers transact
        directly with Sellers; invoxai is not a party to those transactions. Each Seller
        sets their own refund policy, which should be stated on their storefront page. You
        should review the Seller's refund policy before purchasing.
      </p>

      <h2>B2. Digital Products and Courses</h2>
      <p>
        For digital downloads (PDFs, templates, audio files, etc.) and online courses,
        refunds are at the Seller's sole discretion once the content has been accessed or
        downloaded. Many Sellers do not offer refunds on digital goods after access is
        granted, in accordance with applicable consumer-protection guidelines for digital
        content.
      </p>
      <p>
        If the product you received is materially different from what was described, or if
        you were charged but never received access, you should contact the Seller first.
        If the Seller does not respond within 5 business days, contact invoxai support at{" "}
        <a href="mailto:support@invoxai.io">support@invoxai.io</a> and we will mediate.
      </p>

      <h2>B3. Bookings and Events</h2>
      <ul>
        <li>
          <strong>Cancellation by Buyer:</strong> Refund eligibility depends on the
          Seller's stated cancellation window. If no policy is stated, cancellations
          requested more than 48 hours before the event/session start time are eligible
          for a full refund; cancellations within 48 hours are non-refundable unless the
          Seller agrees otherwise.
        </li>
        <li>
          <strong>Cancellation by Seller:</strong> If a Seller cancels a confirmed booking
          or event, Buyers are entitled to a full refund of the amount paid.
        </li>
      </ul>

      <h2>B4. VIP / Subscription Communities</h2>
      <p>
        Access to VIP channels and paid communities is billed in advance. Cancellations
        take effect at the end of the current period; no partial refund is issued for
        unused days unless the Seller's terms state otherwise.
      </p>

      <h2>B5. Razorpay and Payment Gateway Refunds</h2>
      <p>
        Refunds processed through Razorpay (or another gateway) typically take 5–10
        business days to reflect in your bank account or on your card, depending on your
        bank's processing time. invoxai and the Seller have no control over this timeline
        once the refund has been initiated.
      </p>

      <h2>B6. How Buyers Request a Refund</h2>
      <ol>
        <li>
          Check the Seller's storefront for their specific refund/cancellation policy.
        </li>
        <li>
          Contact the Seller directly using the contact details on their page.
        </li>
        <li>
          If you cannot resolve the issue with the Seller, email{" "}
          <a href="mailto:support@invoxai.io">support@invoxai.io</a> with your order
          details (order ID, purchase email, amount, and description of the issue). We
          will review and respond within 5 business days.
        </li>
      </ol>

      <h2>Chargebacks</h2>
      <p>
        We encourage Buyers to contact us before initiating a chargeback with their bank.
        Fraudulent chargebacks may result in suspension of the associated buyer account
        and recovery action by the Seller.
      </p>

      <h2>Contact</h2>
      <p>
        Seller billing queries: <a href="mailto:billing@invoxai.io">billing@invoxai.io</a>
        <br />
        Buyer support: <a href="mailto:support@invoxai.io">support@invoxai.io</a>
      </p>
    </LegalShell>
  );
}
