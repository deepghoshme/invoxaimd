import type { Metadata } from "next";
import LegalShell from "../LegalShell";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy · invoxai.io",
  description:
    "Understand invoxai.io's refund and cancellation policy for Sellers (platform subscriptions and wallet) and Buyers (product purchases).",
};

export default function RefundPage() {
  return (
    <LegalShell title="Refund & Cancellation Policy" updated="June 20, 2026">
      <div className="notice">
        This policy covers two distinct scenarios: (a) refunds to Sellers for
        platform fees paid to invoxai, and (b) refunds to Buyers for purchases
        made through a Seller&apos;s storefront. Please read the relevant section
        carefully before submitting a refund request.
      </div>

      <h2>Part A &mdash; Platform Fees (Sellers)</h2>

      <h2>A1. Subscription Plans</h2>
      <p>
        invoxai offers subscription plans (Starter, Growth, Scale) on monthly and
        annual billing cycles. All paid plans are billed in advance at the start of
        each billing period.
      </p>
      <ul>
        <li>
          <strong>Free Starter plan:</strong> No charge is applicable; no refund
          is relevant.
        </li>
        <li>
          <strong>Monthly paid plans:</strong> You may cancel your subscription at
          any time from the dashboard. Your plan remains active and usable until the
          end of the current billing period. No pro-rata refund is issued for any
          unused days within the period.
        </li>
        <li>
          <strong>Annual paid plans &mdash; 7-day cooling-off:</strong> If you
          subscribed to an annual plan within the last 7 days and have published
          fewer than 5 seller pages under the plan during that time, you are eligible
          for a full refund of the annual subscription fee. Requests must be submitted
          within 7 calendar days of the initial payment date. After 7 days, no refund
          is issued for the remaining period; the plan continues in full until its
          expiry date.
        </li>
        <li>
          <strong>Plan downgrades:</strong> Downgrading from a higher-tier paid plan
          to a lower-tier plan takes effect at the start of the next billing period.
          No refund is issued for the difference in plan fees for the current period.
        </li>
        <li>
          <strong>Duplicate / erroneous charges:</strong> If you are charged more
          than once for the same billing cycle due to a verified technical error on
          our part, you are entitled to a full refund of the duplicate amount. Please
          contact us within 14 calendar days of the charge with proof of the duplicate
          transaction.
        </li>
      </ul>

      <h2>A2. Commission Wallet Top-Ups</h2>
      <p>
        Sellers pre-fund a commission wallet that is automatically debited on each
        completed sale at the applicable commission rate. Wallet top-up amounts are
        non-refundable under normal circumstances because they are held solely for
        the purpose of settling commissions on future transactions.
      </p>
      <p>
        <strong>Exceptions:</strong>
      </p>
      <ul>
        <li>
          <strong>Account closure:</strong> If you close your account and there is
          a positive remaining wallet balance of ₹50 or more, we will refund that
          balance to your original payment instrument within 10 business days of
          account closure confirmation.
        </li>
        <li>
          <strong>Erroneous deduction:</strong> If you believe a commission was
          deducted in error (e.g., for a transaction that was subsequently reversed
          by the payment gateway), contact us with the order ID and we will
          investigate and credit any confirmed erroneous deduction back to your
          wallet within 5 business days.
        </li>
        <li>
          <strong>Promotional wallet credits:</strong> Any bonus credits added to
          your wallet as part of a promotional offer are non-refundable and
          non-transferable under all circumstances.
        </li>
      </ul>

      <h2>A3. How to Request a Platform-Level Refund</h2>
      <ol>
        <li>
          Email <a href="mailto:iamdeep.mk@gmail.com">iamdeep.mk@gmail.com</a>{" "}
          with the subject line: &ldquo;Refund Request &mdash; [your registered
          email address]&rdquo;.
        </li>
        <li>
          Include your registered email address, the transaction ID or invoice
          number (found in your dashboard under Billing), the amount charged, and
          a brief description of why you are requesting a refund.
        </li>
        <li>
          We aim to acknowledge your request within 1&ndash;2 business days and
          provide a decision within 3 business days of receiving all required
          information.
        </li>
        <li>
          Approved refunds are processed within 7&ndash;10 business days back to
          the original payment instrument (card, UPI, net banking, etc.).
          Processing timelines beyond that point are governed by your bank or payment
          gateway.
        </li>
      </ol>

      <h2>Part B &mdash; Product Purchases (Buyers)</h2>

      <h2>B1. General Principle</h2>
      <p>
        invoxai is a technology platform that hosts independent Seller storefronts.
        Buyers transact directly with individual Sellers; invoxai is not a party to
        those purchase contracts. Each Seller sets and is responsible for their own
        refund and cancellation policy, which must be clearly communicated on their
        storefront page.
      </p>
      <p>
        You should always review a Seller&apos;s specific refund policy before
        completing a purchase. The guidelines below serve as platform-level defaults
        where a Seller has not stated a policy, or where a Seller&apos;s policy is
        silent on a particular scenario.
      </p>

      <h2>B2. Digital Products and Downloadable Content</h2>
      <p>
        For digital downloads (PDFs, templates, audio files, video files, software,
        etc.) refunds are subject to the individual Seller&apos;s policy. As a
        general platform guideline:
      </p>
      <ul>
        <li>
          Once a Buyer has accessed or downloaded the content, refunds are at the
          Seller&apos;s sole discretion.
        </li>
        <li>
          If you were charged but never received access to the content (e.g., due
          to a technical error), contact the Seller first. If the Seller does not
          respond within 5 business days, contact invoxai at{" "}
          <a href="mailto:iamdeep.mk@gmail.com">iamdeep.mk@gmail.com</a> with
          your order details. We will investigate and, where we confirm non-delivery
          due to a platform error, facilitate a full refund.
        </li>
        <li>
          If the content delivered is materially and substantially different from
          what was described on the Seller&apos;s page (e.g., wrong file delivered,
          corrupted file), you are entitled to request a refund from the Seller. If
          the Seller refuses without reasonable justification, escalate to invoxai
          support.
        </li>
      </ul>

      <h2>B3. Online Courses</h2>
      <ul>
        <li>
          <strong>Before accessing any content:</strong> If you request a refund
          before accessing any course module, the Seller is expected to honour a
          full refund if requested within 48 hours of purchase, unless their policy
          states otherwise.
        </li>
        <li>
          <strong>After accessing content:</strong> Refunds after course content has
          been accessed are at the Seller&apos;s sole discretion. Many Sellers offer
          a money-back window (e.g., 7 days); check the course listing for details.
        </li>
      </ul>

      <h2>B4. Bookings and Appointments</h2>
      <ul>
        <li>
          <strong>Cancellation by Buyer &mdash; more than 48 hours before:</strong>{" "}
          Where the Seller has not specified a cancellation policy, Buyers who cancel
          a confirmed booking more than 48 hours before the scheduled start time are
          eligible for a full refund.
        </li>
        <li>
          <strong>Cancellation by Buyer &mdash; within 48 hours:</strong> Cancellations
          made within 48 hours of the scheduled start are non-refundable unless the
          Seller agrees otherwise, or unless the cancellation is necessitated by a
          demonstrable error on the Seller&apos;s part.
        </li>
        <li>
          <strong>Cancellation by Seller:</strong> If a Seller cancels a confirmed
          booking or appointment, the Buyer is entitled to a full refund of the amount
          paid, regardless of when the cancellation occurs.
        </li>
        <li>
          <strong>No-shows:</strong> If a Buyer does not attend a confirmed booking
          without prior cancellation, no refund is due unless the Seller&apos;s policy
          states otherwise.
        </li>
      </ul>

      <h2>B5. Events (Tickets)</h2>
      <ul>
        <li>
          Refund eligibility for event tickets is determined by the Seller&apos;s
          stated event policy. If no policy is stated, the same 48-hour cancellation
          rule as for bookings applies.
        </li>
        <li>
          If an event is cancelled entirely by the Seller, all Buyers who purchased
          tickets are entitled to a full refund.
        </li>
        <li>
          If an event is postponed by the Seller, Buyers may request a refund within
          7 days of the postponement announcement; after 7 days the ticket is
          considered valid for the new date.
        </li>
      </ul>

      <h2>B6. VIP Memberships and Paid Communities</h2>
      <p>
        Access to VIP channels, WhatsApp groups, Telegram groups, and other paid
        community memberships is billed in advance for the selected period (monthly
        or annual). Cancellations take effect at the end of the current paid period;
        no partial refund is issued for unused days unless the Seller&apos;s stated
        terms provide otherwise.
      </p>

      <h2>B7. Subscription Products (Recurring Billing)</h2>
      <p>
        If you have purchased a recurring subscription product from a Seller, you
        may cancel future billing at any time. Cancellation prevents future charges
        but does not automatically entitle you to a refund for the current period.
        Contact the Seller to request a mid-period refund.
      </p>

      <h2>B8. Refund Processing Timelines</h2>
      <p>
        Refunds are processed back through the original payment method (Razorpay,
        Cashfree, Stripe, PayU, or PhonePe). Once a refund is initiated by the
        Seller or invoxai, typical processing times are:
      </p>
      <ul>
        <li>
          <strong>Credit / debit cards:</strong> 5&ndash;10 business days to appear
          on your statement, depending on your card issuer.
        </li>
        <li>
          <strong>UPI / net banking:</strong> 2&ndash;5 business days.
        </li>
        <li>
          <strong>Wallets (Paytm, PhonePe, etc.):</strong> 1&ndash;3 business days.
        </li>
      </ul>
      <p>
        Neither the Seller nor invoxai has control over the timeline once the refund
        has been submitted to the payment gateway. If you have not received a refund
        after the above window, please check with your bank before contacting us.
      </p>

      <h2>B9. How Buyers Request a Refund</h2>
      <ol>
        <li>
          Review the Seller&apos;s stated refund/cancellation policy on their
          storefront page (usually found under &ldquo;Policies&rdquo; or in the
          product description).
        </li>
        <li>
          Contact the Seller directly using the contact details or form on their
          storefront page.
        </li>
        <li>
          If the Seller does not respond within 5 business days, or if you cannot
          reach a fair resolution, escalate to invoxai by emailing{" "}
          <a href="mailto:iamdeep.mk@gmail.com">iamdeep.mk@gmail.com</a> with:
          <ul>
            <li>Your order ID (from your confirmation email).</li>
            <li>The email address used to purchase.</li>
            <li>The amount charged and date of purchase.</li>
            <li>A clear description of the issue and resolution you are seeking.</li>
          </ul>
        </li>
        <li>
          invoxai will review your request and respond within 5 business days. We
          will mediate in good faith, but our ability to compel a Seller to issue a
          refund is limited to cases involving clear platform errors or non-delivery
          attributable to the platform itself.
        </li>
      </ol>

      <h2>B10. Chargebacks</h2>
      <p>
        We strongly encourage Buyers to contact us before initiating a chargeback
        with their card issuer or bank, as chargebacks take significantly longer to
        resolve and may result in additional fees. If a chargeback is filed without
        prior attempt to resolve the issue with invoxai:
      </p>
      <ul>
        <li>
          The associated Buyer account may be suspended pending investigation.
        </li>
        <li>
          If the chargeback is found to be fraudulent or filed in bad faith, the
          Seller and invoxai reserve the right to pursue recovery through appropriate
          legal channels.
        </li>
      </ul>

      <h2>Contact Us</h2>
      <p>
        For all refund and billing enquiries (Sellers and Buyers):
      </p>
      <ul>
        <li>
          <strong>Email:</strong>{" "}
          <a href="mailto:iamdeep.mk@gmail.com">iamdeep.mk@gmail.com</a>
        </li>
        <li>
          <strong>Subject line format:</strong> &ldquo;Refund Request &mdash;
          [Order ID or Invoice Number]&rdquo;
        </li>
        <li>
          <strong>Response time:</strong> Within 1&ndash;2 business days (Mon&ndash;Fri,
          10 AM &ndash; 6 PM IST).
        </li>
      </ul>
    </LegalShell>
  );
}
