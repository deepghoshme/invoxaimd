import type { Metadata } from "next";
import LegalShell from "../LegalShell";

export const metadata: Metadata = {
  title: "Terms of Service · invoxai.io",
  description:
    "Read the Terms of Service governing your use of invoxai.io as a Seller or Buyer.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="June 20, 2026">
      <div className="notice">
        Please read these Terms carefully before using invoxai.io. By registering
        an account, publishing a page, or purchasing through a storefront on this
        platform you agree to be bound by these Terms of Service. If you do not
        agree, you must not use the platform.
      </div>

      <h2>1. Definitions</h2>
      <p>
        <strong>&ldquo;invoxai&rdquo; / &ldquo;Platform&rdquo;</strong> means invoxai.io
        and all associated services, APIs, dashboards, and infrastructure operated by us.
      </p>
      <p>
        <strong>&ldquo;Seller&rdquo;</strong> means any individual or business entity
        that registers an account to create pages, list products or services, or collect
        payments through the Platform.
      </p>
      <p>
        <strong>&ldquo;Buyer&rdquo;</strong> means any person who purchases a product
        or service through a Seller&apos;s storefront or page hosted on the Platform.
      </p>
      <p>
        <strong>&ldquo;Content&rdquo;</strong> means any text, images, videos,
        descriptions, pricing, files, and other material uploaded or published by a
        Seller or user.
      </p>
      <p>
        <strong>&ldquo;Plan&rdquo;</strong> means the subscription tier (e.g., Starter,
        Growth, Scale) that governs a Seller&apos;s access to platform features and
        commission rates.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years of age and legally capable of entering into a
        binding contract under the laws of India to use invoxai as a Seller. Buyers
        must be at least 18 or have the verifiable consent of a parent or guardian.
        By using the Platform you represent and warrant that you meet these eligibility
        requirements and that all information you provide is accurate and truthful.
      </p>
      <p>
        If you are accessing or using the Platform on behalf of a company or other
        legal entity, you represent that you have the authority to bind that entity
        to these Terms. In that case, &ldquo;you&rdquo; refers to that entity.
      </p>

      <h2>3. Account Registration and Security</h2>
      <ul>
        <li>
          You must provide a valid email address and complete OTP verification to
          create an account. Providing false or misleading information is a breach
          of these Terms.
        </li>
        <li>
          You are responsible for maintaining the confidentiality of your login
          credentials and for all activity that occurs under your account. invoxai
          uses magic-link / OTP-based authentication; you must keep access to your
          registered email secure.
        </li>
        <li>
          You must notify us immediately at{" "}
          <a href="mailto:iamdeep.mk@gmail.com">iamdeep.mk@gmail.com</a> if you
          suspect any unauthorised access to your account.
        </li>
        <li>
          Each account is personal to the registered user. You may not share, sell,
          or transfer your account credentials to another person.
        </li>
        <li>
          invoxai reserves the right to refuse registration to anyone at our sole
          discretion.
        </li>
      </ul>

      <h2>4. Seller Obligations and Responsibilities</h2>
      <ul>
        <li>
          <strong>Accuracy of listings:</strong> You are solely responsible for the
          accuracy of all Content you publish, including product descriptions, prices,
          delivery timelines, eligibility requirements, and any claims made about your
          products or services.
        </li>
        <li>
          <strong>Lawful products only:</strong> You must not list or sell illegal,
          counterfeit, hazardous, adult (18+), or otherwise prohibited goods or
          services. invoxai reserves the right to remove any Content and suspend any
          account that violates this rule, with or without prior notice and without
          liability to you.
        </li>
        <li>
          <strong>Taxes:</strong> You are solely responsible for determining and
          remitting applicable taxes on your sales, including GST, TDS, and any other
          levies under Indian law. invoxai does not provide tax advice and is not
          liable for your tax obligations.
        </li>
        <li>
          <strong>Delivery:</strong> You are responsible for fulfilling all orders
          placed through your pages promptly and as described. Failure to deliver
          may result in disputes, chargebacks, and account suspension.
        </li>
        <li>
          <strong>Refund policy:</strong> You must clearly communicate your refund
          and cancellation policy to Buyers on your storefront. See our Refund Policy
          for platform-level guidelines that apply where a Seller has no policy.
        </li>
        <li>
          <strong>Compliance:</strong> You are responsible for complying with all
          applicable laws relating to your business, including consumer protection,
          data privacy, e-commerce regulations, and professional licensing requirements.
        </li>
      </ul>

      <h2>5. Subscription Plans and Billing</h2>
      <p>
        invoxai offers tiered subscription plans (Starter, Growth, Scale) with
        monthly and annual billing options. Plan details, pricing, and included
        features are as described on the Pricing page at the time of your subscription.
      </p>
      <ul>
        <li>
          <strong>Billing in advance:</strong> Paid plans are billed at the start of
          each billing period (monthly or annual).
        </li>
        <li>
          <strong>Plan upgrades/downgrades:</strong> You may change your plan at any
          time from the dashboard. Upgrades take effect immediately; downgrades take
          effect at the start of the next billing period.
        </li>
        <li>
          <strong>Price changes:</strong> invoxai may change plan pricing with at
          least 30 days&apos; advance notice. Existing subscribers will be notified by
          email before the change affects their billing.
        </li>
        <li>
          <strong>Failed payments:</strong> If a subscription payment fails, we will
          attempt to retry. After two failed attempts, your account may be downgraded
          to the free tier until payment is resolved.
        </li>
      </ul>

      <h2>6. Commission Wallet and Payment Processing</h2>
      <p>
        Sellers connect their own payment gateway accounts (Razorpay, Cashfree, Stripe,
        PayU, or PhonePe). Payments from Buyers flow directly into the Seller&apos;s
        connected gateway account; invoxai does not hold, escrow, or intermediate Seller
        funds.
      </p>
      <p>
        invoxai charges a commission on each completed sale. The commission rate is
        determined by your active Plan (ranging from approximately 1.5% to 6% per
        transaction). This commission is automatically deducted from your pre-funded
        invoxai wallet at the time of each sale.
      </p>
      <ul>
        <li>
          <strong>Wallet top-up:</strong> Sellers must maintain a positive wallet
          balance to enable checkout on their pages. invoxai may automatically pause
          checkout on pages where the wallet balance is insufficient.
        </li>
        <li>
          <strong>Low-balance alerts:</strong> We will send email alerts when your
          wallet balance falls below a configured threshold so you can top up before
          checkout is affected.
        </li>
        <li>
          <strong>Transaction disputes:</strong> All disputes between Buyers and
          Sellers regarding payment or delivery are to be resolved directly between
          those parties. invoxai is a platform intermediary, not a party to individual
          Buyer-Seller transactions, and is not liable for payment failures, chargebacks,
          or refund disputes.
        </li>
      </ul>

      <h2>7. Intellectual Property</h2>
      <p>
        <strong>Your Content:</strong> Sellers retain full ownership of all Content
        they upload. By publishing Content on invoxai, you grant invoxai a
        non-exclusive, royalty-free, worldwide, sublicensable licence to host, cache,
        display, and transmit that Content solely for the purpose of operating and
        delivering the Platform and its services. This licence terminates when you
        delete the Content or close your account, except where retention is required
        by law.
      </p>
      <p>
        <strong>invoxai IP:</strong> The invoxai name, logo, platform code, design
        system, and all related intellectual property are the exclusive property of
        invoxai and its licensors. You may not reproduce, distribute, modify, create
        derivative works of, or commercially exploit any invoxai intellectual property
        without prior written permission.
      </p>
      <p>
        <strong>Feedback:</strong> If you submit ideas, suggestions, or feedback about
        the Platform, you grant invoxai a perpetual, irrevocable, royalty-free licence
        to use and implement that feedback without any obligation to you.
      </p>

      <h2>8. Prohibited Conduct</h2>
      <p>You agree not to use the Platform to:</p>
      <ul>
        <li>
          Violate any applicable local, national, or international law or regulation.
        </li>
        <li>
          List or promote illegal goods, services, counterfeit products, financial
          pyramid schemes, or gambling services.
        </li>
        <li>
          Gain or attempt to gain unauthorised access to any part of the Platform,
          other user accounts, or our infrastructure.
        </li>
        <li>
          Perform automated data scraping, crawling, or bulk extraction of Platform
          data except as explicitly permitted via our API with prior written consent.
        </li>
        <li>
          Introduce or transmit any virus, malware, ransomware, or other malicious
          code.
        </li>
        <li>
          Send unsolicited commercial communications (spam) to Buyers or other users.
        </li>
        <li>
          Impersonate any person, entity, or brand, or misrepresent your affiliation
          with any person or entity.
        </li>
        <li>
          Publish or distribute content that is defamatory, obscene, hateful,
          discriminatory, or that infringes the intellectual property rights of any
          third party.
        </li>
        <li>
          Use the Platform in any way that could disable, overburden, damage, or
          impair its functionality or interfere with other users&apos; use of the Platform.
        </li>
      </ul>

      <h2>9. Third-Party Services and Links</h2>
      <p>
        The Platform integrates with and may display links to third-party services,
        including payment gateways, email providers, and analytics tools. invoxai
        does not control these services and is not responsible for their content,
        privacy practices, or terms. Your use of third-party services is governed
        by their respective terms and policies.
      </p>

      <h2>10. Availability and Uptime</h2>
      <p>
        invoxai aims to provide a reliable, high-availability platform but does not
        guarantee uninterrupted access. We may perform scheduled maintenance that
        temporarily affects availability; we will endeavour to provide advance notice
        for significant maintenance windows. invoxai shall not be liable for losses
        arising from planned or unplanned downtime.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;
        WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
        TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, OR
        NON-INFRINGEMENT. INVOXAI DOES NOT WARRANT THAT THE PLATFORM WILL BE
        UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL
        COMPONENTS.
      </p>
      <p>
        INVOXAI DOES NOT ENDORSE, VERIFY, OR TAKE RESPONSIBILITY FOR ANY SELLER
        CONTENT, PRODUCTS, SERVICES, OR CLAIMS MADE ON THE PLATFORM. BUYERS TRANSACT
        WITH SELLERS AT THEIR OWN RISK.
      </p>

      <h2>12. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, INVOXAI, ITS AFFILIATES,
        DIRECTORS, OFFICERS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY
        INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE
        DAMAGES, INCLUDING LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS
        OPPORTUNITIES, ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR YOUR USE
        OF THE PLATFORM, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
      </p>
      <p>
        INVOXAI&apos;S TOTAL AGGREGATE LIABILITY TO ANY SELLER OR BUYER FOR ANY CLAIM
        ARISING UNDER OR IN CONNECTION WITH THESE TERMS SHALL NOT EXCEED THE TOTAL
        FEES PAID BY THAT PARTY TO INVOXAI IN THE THREE (3) CALENDAR MONTHS
        IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
      </p>

      <h2>13. Indemnification</h2>
      <p>
        You agree to indemnify, defend, and hold harmless invoxai and its affiliates,
        directors, officers, employees, agents, and licensors from and against any
        and all claims, liabilities, damages, losses, costs, and expenses (including
        reasonable legal fees) arising out of or related to: (a) your use of or
        access to the Platform; (b) your Content; (c) your products or services
        offered through the Platform; (d) your violation of these Terms; or (e) your
        violation of any rights of any third party.
      </p>

      <h2>14. Suspension and Termination</h2>
      <p>
        invoxai may suspend, restrict, or terminate your account and access to the
        Platform at any time, with or without prior notice, if we reasonably believe
        you have violated these Terms, engaged in fraudulent activity, or if your
        account has been inactive for more than 12 consecutive months.
      </p>
      <p>
        Sellers may close their accounts at any time via the account settings in the
        dashboard. Upon account closure: (a) your published pages will be taken
        offline; (b) any remaining wallet balance above ₹50 will be refunded to your
        original payment method within 10 business days; (c) you remain responsible
        for any outstanding obligations to Buyers that arose before closure.
      </p>
      <p>
        Sections 7, 11, 12, 13, 15, and 16 of these Terms survive termination.
      </p>

      <h2>15. Governing Law</h2>
      <p>
        These Terms and any dispute or claim arising out of or in connection with
        them shall be governed by and construed in accordance with the laws of India,
        without regard to its conflict-of-law provisions.
      </p>

      <h2>16. Dispute Resolution</h2>
      <p>
        In the event of any dispute, the parties shall first attempt to resolve the
        matter through good-faith negotiation. Either party may initiate this process
        by sending a written notice to the other describing the dispute and their
        preferred resolution.
      </p>
      <p>
        If the dispute is not resolved within 30 days of such notice, it shall be
        referred to and finally resolved by binding arbitration under the Arbitration
        and Conciliation Act, 1996 (as amended). The seat and venue of arbitration
        shall be Bengaluru, Karnataka, India. The arbitration shall be conducted in
        English by a sole arbitrator agreed upon by the parties or, failing agreement,
        appointed in accordance with the Act.
      </p>
      <p>
        Nothing in this clause prevents either party from seeking urgent injunctive
        or other equitable relief from a court of competent jurisdiction.
      </p>

      <h2>17. Changes to These Terms</h2>
      <p>
        We may modify these Terms at any time. We will provide at least 15 days&apos;
        advance notice of material changes via email to registered Sellers and/or a
        prominent notice on the Platform. Your continued use of the Platform after the
        effective date of the revised Terms constitutes your acceptance of the changes.
        If you do not agree to the revised Terms, you must stop using the Platform and
        may close your account before the effective date.
      </p>

      <h2>18. Miscellaneous</h2>
      <ul>
        <li>
          <strong>Entire agreement:</strong> These Terms, together with our Privacy
          Policy and Refund Policy, constitute the entire agreement between you and
          invoxai with respect to the Platform.
        </li>
        <li>
          <strong>Severability:</strong> If any provision of these Terms is found to
          be unenforceable, the remaining provisions shall continue in full force and
          effect.
        </li>
        <li>
          <strong>Waiver:</strong> Failure to enforce any provision of these Terms
          shall not constitute a waiver of our right to enforce that provision in
          the future.
        </li>
        <li>
          <strong>Assignment:</strong> You may not assign your rights or obligations
          under these Terms without invoxai&apos;s prior written consent. invoxai may
          assign its rights without restriction.
        </li>
        <li>
          <strong>Force majeure:</strong> invoxai is not liable for delays or failures
          in performance caused by circumstances beyond our reasonable control,
          including acts of God, natural disasters, government actions, or internet
          infrastructure failures.
        </li>
      </ul>

      <h2>19. Contact</h2>
      <p>
        For questions, concerns, or notices under these Terms, please contact us:
      </p>
      <ul>
        <li>
          <strong>Email:</strong>{" "}
          <a href="mailto:iamdeep.mk@gmail.com">iamdeep.mk@gmail.com</a>
        </li>
        <li>
          <strong>Website:</strong>{" "}
          <a href="https://invoxai.io/contact">invoxai.io/contact</a>
        </li>
      </ul>
    </LegalShell>
  );
}
