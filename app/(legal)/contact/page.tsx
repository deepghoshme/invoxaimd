import type { Metadata } from "next";
import LegalShell from "../LegalShell";

export const metadata: Metadata = {
  title: "Contact Us · invoxai.io",
  description:
    "Get in touch with the invoxai.io team for support, billing, legal, or general enquiries.",
};

export default function ContactPage() {
  return (
    <LegalShell title="Contact Us" updated="June 20, 2026">
      <div className="notice">
        We typically respond to all enquiries within 1&ndash;2 business days
        (Monday to Friday, 10 AM &ndash; 6 PM IST). For faster resolution, please
        include your registered email address and, where relevant, your order ID or
        invoice number in your message.
      </div>

      <h2>General &amp; Support</h2>
      <p>
        For questions about using the platform, account issues, feature requests, or
        any other general support:
      </p>
      <ul>
        <li>
          <strong>Email:</strong>{" "}
          <a href="mailto:iamdeep.mk@gmail.com">iamdeep.mk@gmail.com</a>
        </li>
        <li>
          <strong>In-app:</strong> Use the Help section inside your Seller dashboard
          to submit a support ticket directly.
        </li>
      </ul>

      <h2>Billing &amp; Refunds</h2>
      <p>
        For subscription billing, wallet top-ups, refund requests, or invoice queries:
      </p>
      <ul>
        <li>
          <strong>Email:</strong>{" "}
          <a href="mailto:iamdeep.mk@gmail.com">iamdeep.mk@gmail.com</a>
        </li>
        <li>
          <strong>Subject line:</strong> &ldquo;Billing &mdash; [your registered email]&rdquo;
        </li>
        <li>
          Please attach or reference your transaction ID / invoice number for faster
          processing.
        </li>
        <li>
          See our{" "}
          <a href="/refund">Refund &amp; Cancellation Policy</a> for eligibility
          details before submitting a request.
        </li>
      </ul>

      <h2>Legal &amp; Privacy</h2>
      <p>
        For privacy requests (data access, deletion, correction), terms enquiries, or
        intellectual property concerns:
      </p>
      <ul>
        <li>
          <strong>Email:</strong>{" "}
          <a href="mailto:iamdeep.mk@gmail.com">iamdeep.mk@gmail.com</a>
        </li>
        <li>
          <strong>Subject line:</strong> &ldquo;Privacy Request &mdash; [your registered email]&rdquo;
          or &ldquo;Legal Enquiry&rdquo;
        </li>
        <li>
          We aim to respond to all data rights requests within 30 days as required by
          applicable law.
        </li>
      </ul>

      <h2>Payment Gateway &amp; Compliance</h2>
      <p>
        invoxai integrates with Razorpay, Cashfree, Stripe, PayU, and PhonePe.
        Sellers connect their own gateway accounts. If you have a payment dispute or
        a compliance-related query regarding a specific transaction:
      </p>
      <ul>
        <li>
          For disputes relating to your <strong>payment gateway account</strong>,
          contact your gateway&apos;s support directly (Razorpay, Cashfree, etc.).
        </li>
        <li>
          For disputes relating to <strong>platform commissions</strong> or
          <strong> wallet deductions</strong>, contact us at{" "}
          <a href="mailto:iamdeep.mk@gmail.com">iamdeep.mk@gmail.com</a>.
        </li>
      </ul>

      <h2>Partnerships &amp; Press</h2>
      <p>
        For partnership proposals, media enquiries, or collaboration opportunities:
      </p>
      <ul>
        <li>
          <strong>Email:</strong>{" "}
          <a href="mailto:iamdeep.mk@gmail.com">iamdeep.mk@gmail.com</a>
        </li>
        <li>
          <strong>Subject line:</strong> &ldquo;Partnership&rdquo; or &ldquo;Press Enquiry&rdquo;
        </li>
      </ul>

      <h2>Registered Information</h2>
      <ul>
        <li><strong>Platform:</strong> invoxai.io</li>
        <li><strong>Country of operation:</strong> India</li>
        <li>
          <strong>Primary contact email:</strong>{" "}
          <a href="mailto:iamdeep.mk@gmail.com">iamdeep.mk@gmail.com</a>
        </li>
      </ul>

      <h2>Useful Links</h2>
      <ul>
        <li><a href="/privacy">Privacy Policy</a></li>
        <li><a href="/terms">Terms of Service</a></li>
        <li><a href="/refund">Refund &amp; Cancellation Policy</a></li>
      </ul>
    </LegalShell>
  );
}
