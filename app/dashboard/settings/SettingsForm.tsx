"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import ImageInput from "@/components/ImageInput";
import { saveStoreSettings, saveProfileSettings } from "./actions";

type Cat = { id: string; name: string };

const CURRENCIES = [
  { value: "INR", label: "INR — Indian Rupee (₹)" },
  { value: "USD", label: "USD — US Dollar ($)" },
  { value: "EUR", label: "EUR — Euro (€)" },
  { value: "GBP", label: "GBP — British Pound (£)" },
];

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST, +05:30)" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New_York (ET)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PT)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST, +04:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT, +08:00)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST)" },
];

type Feedback = { msg: string; ok: boolean } | null;

function useFeedback() {
  const [fb, setFb] = useState<Feedback>(null);
  function show(msg: string, ok: boolean) {
    setFb({ msg, ok });
    if (ok) setTimeout(() => setFb(null), 2500);
  }
  return { fb, show };
}

function FeedbackRow({ fb }: { fb: Feedback }) {
  if (!fb) return null;
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        marginTop: 6,
        background: fb.ok
          ? "color-mix(in srgb, var(--green, #22c55e) 14%, transparent)"
          : "color-mix(in srgb, var(--primary) 12%, transparent)",
        color: fb.ok ? "var(--green, #22c55e)" : "var(--primary)",
      }}
    >
      {fb.msg}
    </div>
  );
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>
        {title}
      </h3>
      {sub && (
        <p className="dx-muted" style={{ fontSize: 12.5, marginTop: 3, marginBottom: 0 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default function SettingsForm({
  storeName,
  subdomain,
  categoryId,
  categories,
  logoUrl,
  fullName,
  avatarUrl,
  accountEmail,
  replyToEmail,
  supportEmail,
  currency,
  timezone,
  legalName,
  gstin,
  gstRate,
  billingBusinessName,
  billingAddress,
  billingCity,
  billingState,
  billingPostalCode,
  billingPhone,
  mobileNumber,
  socialInstagram,
  socialTwitter,
  socialYoutube,
  socialWebsite,
  walletBalance,
  customDomain,
  customDomainVerified,
  primaryDomain,
}: {
  storeName: string;
  subdomain: string | null;
  categoryId: string | null;
  categories: Cat[];
  logoUrl: string;
  fullName: string;
  avatarUrl: string;
  accountEmail: string;
  replyToEmail: string;
  supportEmail: string;
  currency: string;
  timezone: string;
  legalName: string;
  gstin: string;
  gstRate: number | null;
  billingBusinessName: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingPhone: string;
  mobileNumber: string;
  socialInstagram: string;
  socialTwitter: string;
  socialYoutube: string;
  socialWebsite: string;
  walletBalance: number;
  customDomain: string | null;
  customDomainVerified: boolean | null;
  primaryDomain: string | null;
}) {
  // Section 1 state
  const [name, setName] = useState(storeName);
  const [cat, setCat] = useState(categoryId ?? "");
  const [logo, setLogo] = useState(logoUrl);

  // Section 2 state
  const [fullNameVal, setFullName] = useState(fullName);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [mobile, setMobile] = useState(mobileNumber);

  // Section 3 state
  const [replyTo, setReplyTo] = useState(replyToEmail);
  const [supportEm, setSupportEm] = useState(supportEmail);
  const [curr, setCurr] = useState(currency || "INR");
  const [tz, setTz] = useState(timezone);

  // Section 4 state
  const [legalNameVal, setLegalName] = useState(legalName);
  const [gstinVal, setGstin] = useState(gstin);
  const [gstRateVal, setGstRate] = useState(gstRate != null ? String(gstRate) : "");
  const [bizName, setBizName] = useState(billingBusinessName);
  const [address, setAddress] = useState(billingAddress);
  const [stateVal, setStateVal] = useState(billingState);
  const [city, setCity] = useState(billingCity);
  const [postal, setPostal] = useState(billingPostalCode);
  const [phone, setPhone] = useState(billingPhone);

  // Section 5 state
  const [instagram, setInstagram] = useState(socialInstagram);
  const [twitter, setTwitter] = useState(socialTwitter);
  const [youtube, setYoutube] = useState(socialYoutube);
  const [website, setWebsite] = useState(socialWebsite);

  // Feedback per section
  const storeFb = useFeedback();
  const profileFb = useFeedback();
  const contactFb = useFeedback();
  const taxFb = useFeedback();
  const socialFb = useFeedback();

  const [isPending, startTransition] = useTransition();
  const [activeSave, setActiveSave] = useState<string | null>(null);

  function inrFromPaise(paise: number) {
    return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
  }

  // Shared payload builder so every section save keeps all fields in sync
  function buildStorePayload() {
    return {
      store_name: name,
      category_id: cat || null,
      logo_url: logo || null,
      reply_to_email: replyTo || null,
      support_email: supportEm || null,
      currency: curr,
      timezone: tz || null,
      legal_name: legalNameVal || null,
      gstin: gstinVal || null,
      gst_rate: gstRateVal !== "" ? Number(gstRateVal) : null,
      billing_patch: {
        business_name: bizName,
        address,
        city,
        state: stateVal,
        postal_code: postal,
        phone,
      },
      social_links: { instagram, twitter, youtube, website },
    };
  }

  function saveStore() {
    setActiveSave("store");
    startTransition(async () => {
      const res = await saveStoreSettings(buildStorePayload());
      setActiveSave(null);
      storeFb.show(res.ok ? "Store details saved." : (res.error ?? "Save failed."), res.ok);
    });
  }

  function saveProfile() {
    setActiveSave("profile");
    startTransition(async () => {
      const res = await saveProfileSettings({ full_name: fullNameVal, avatar_url: avatar, mobile_number: mobile });
      setActiveSave(null);
      profileFb.show(res.ok ? "Profile saved." : (res.error ?? "Save failed."), res.ok);
    });
  }

  function saveContact() {
    setActiveSave("contact");
    startTransition(async () => {
      const res = await saveStoreSettings(buildStorePayload());
      setActiveSave(null);
      contactFb.show(
        res.ok ? "Contact & locale saved." : (res.error ?? "Save failed."),
        res.ok,
      );
    });
  }

  function saveTax() {
    setActiveSave("tax");
    startTransition(async () => {
      const res = await saveStoreSettings(buildStorePayload());
      setActiveSave(null);
      taxFb.show(
        res.ok ? "Business & tax info saved." : (res.error ?? "Save failed."),
        res.ok,
      );
    });
  }

  function saveSocial() {
    setActiveSave("social");
    startTransition(async () => {
      const res = await saveStoreSettings(buildStorePayload());
      setActiveSave(null);
      socialFb.show(res.ok ? "Social links saved." : (res.error ?? "Save failed."), res.ok);
    });
  }

  const busy = isPending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Section 1: Store */}
      <div className="dx-card">
        <SectionHead title="Store" sub="Your public-facing store details." />
        <div className="dx-field">
          <label>Store name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your store" />
        </div>
        <div className="dx-ff">
          <div className="dx-field">
            <label>Category</label>
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="dx-field">
            <label>Subdomain</label>
            <input value={subdomain ? `${subdomain}.invoxai.io` : ""} disabled />
          </div>
        </div>
        <div className="dx-field">
          <label>Store logo</label>
          <ImageInput value={logo} onChange={setLogo} placeholder="https://…/logo.png" />
        </div>
        <FeedbackRow fb={storeFb.fb} />
        <button
          className="btn grad"
          onClick={saveStore}
          disabled={busy && activeSave === "store"}
          style={{ marginTop: 6 }}
        >
          {busy && activeSave === "store" ? "Saving…" : "Save store details"}
        </button>
      </div>

      {/* Section 2: Your profile */}
      <div className="dx-card">
        <SectionHead
          title="Your profile"
          sub="Your personal display name and avatar shown to your team."
        />
        <div className="dx-field">
          <label>Full name</label>
          <input
            value={fullNameVal}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
          />
        </div>
        <div className="dx-field">
          <label>Avatar</label>
          <ImageInput value={avatar} onChange={setAvatar} placeholder="https://…/avatar.jpg" />
        </div>
        <div className="dx-field">
          <label>Mobile number</label>
          <input
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="+91 98765 43210"
          />
          <p className="dx-muted" style={{ fontSize: 12, marginTop: 4 }}>
            Your personal contact number. Not shown publicly.
          </p>
        </div>
        <div className="dx-field">
          <label>Account email</label>
          <input value={accountEmail} disabled title="Email cannot be changed here." />
          <p className="dx-muted" style={{ fontSize: 12, marginTop: 4 }}>
            To change your account email, contact support.
          </p>
        </div>
        <FeedbackRow fb={profileFb.fb} />
        <button
          className="btn grad"
          onClick={saveProfile}
          disabled={busy && activeSave === "profile"}
          style={{ marginTop: 6 }}
        >
          {busy && activeSave === "profile" ? "Saving…" : "Save profile"}
        </button>
      </div>

      {/* Section 3: Contact & locale */}
      <div className="dx-card">
        <SectionHead
          title="Contact & locale"
          sub="How buyers reach you, and your store's regional settings."
        />
        <div className="dx-ff">
          <div className="dx-field">
            <label>Support email</label>
            <input
              type="email"
              value={supportEm}
              onChange={(e) => setSupportEm(e.target.value)}
              placeholder="support@yourdomain.com"
            />
            <p className="dx-muted" style={{ fontSize: 12, marginTop: 4 }}>
              Shown on your public storefront as a contact address.
            </p>
          </div>
          <div className="dx-field">
            <label>Reply-to email</label>
            <input
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="you@yourdomain.com"
            />
            <p className="dx-muted" style={{ fontSize: 12, marginTop: 4 }}>
              Buyer replies to order emails go here. Sender stays an invoxai address.
            </p>
          </div>
        </div>
        <div className="dx-ff">
          <div className="dx-field">
            <label>Currency</label>
            <select value={curr} onChange={(e) => setCurr(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="dx-field">
            <label>Timezone</label>
            <select value={tz} onChange={(e) => setTz(e.target.value)}>
              <option value="">Select…</option>
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <FeedbackRow fb={contactFb.fb} />
        <button
          className="btn grad"
          onClick={saveContact}
          disabled={busy && activeSave === "contact"}
          style={{ marginTop: 6 }}
        >
          {busy && activeSave === "contact" ? "Saving…" : "Save contact & locale"}
        </button>
      </div>

      {/* Section 4: Business & tax */}
      <div className="dx-card">
        <SectionHead
          title="Business & tax (GST)"
          sub="Legal entity, GSTIN, and billing address used on invoices."
        />
        <div className="dx-ff">
          <div className="dx-field">
            <label>Legal business name</label>
            <input
              value={legalNameVal}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Acme Private Limited"
            />
          </div>
          <div className="dx-field">
            <label>GSTIN</label>
            <input
              value={gstinVal}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="29ABCDE1234F1Z5"
              maxLength={15}
              style={{ fontFamily: "monospace" }}
            />
            <p className="dx-muted" style={{ fontSize: 12, marginTop: 4 }}>
              15-character GST identification number. Leave blank if not registered.
            </p>
          </div>
        </div>
        <div className="dx-field" style={{ maxWidth: 200 }}>
          <label>GST rate (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={gstRateVal}
            onChange={(e) => setGstRate(e.target.value)}
            placeholder="18"
          />
        </div>
        <div
          style={{
            borderTop: "1px solid var(--border)",
            marginTop: 10,
            paddingTop: 14,
            marginBottom: 4,
          }}
        >
          <p
            className="dx-muted"
            style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 10, marginTop: 0 }}
          >
            Business address (for invoices)
          </p>
        </div>
        <div className="dx-field">
          <label>Business name (as on invoice)</label>
          <input
            value={bizName}
            onChange={(e) => setBizName(e.target.value)}
            placeholder="Acme Private Limited"
          />
        </div>
        <div className="dx-field">
          <label>Address line</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123, MG Road"
          />
        </div>
        <div className="dx-ff">
          <div className="dx-field">
            <label>City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Bengaluru"
            />
          </div>
          <div className="dx-field">
            <label>State</label>
            <input
              value={stateVal}
              onChange={(e) => setStateVal(e.target.value)}
              placeholder="Karnataka"
            />
          </div>
          <div className="dx-field">
            <label>Postal code</label>
            <input
              value={postal}
              onChange={(e) => setPostal(e.target.value)}
              placeholder="560001"
            />
          </div>
        </div>
        <div className="dx-field" style={{ maxWidth: 300 }}>
          <label>Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
          />
        </div>
        <FeedbackRow fb={taxFb.fb} />
        <button
          className="btn grad"
          onClick={saveTax}
          disabled={busy && activeSave === "tax"}
          style={{ marginTop: 6 }}
        >
          {busy && activeSave === "tax" ? "Saving…" : "Save business & tax"}
        </button>
      </div>

      {/* Section 5: Social links */}
      <div className="dx-card">
        <SectionHead title="Social links" sub="Linked on your public storefront and bio page." />
        <div className="dx-ff">
          <div className="dx-field">
            <label>Instagram URL</label>
            <input
              type="url"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="https://instagram.com/yourhandle"
            />
          </div>
          <div className="dx-field">
            <label>X / Twitter URL</label>
            <input
              type="url"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              placeholder="https://x.com/yourhandle"
            />
          </div>
        </div>
        <div className="dx-ff">
          <div className="dx-field">
            <label>YouTube URL</label>
            <input
              type="url"
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              placeholder="https://youtube.com/@yourchannel"
            />
          </div>
          <div className="dx-field">
            <label>Website URL</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yoursite.com"
            />
          </div>
        </div>
        <FeedbackRow fb={socialFb.fb} />
        <button
          className="btn grad"
          onClick={saveSocial}
          disabled={busy && activeSave === "social"}
          style={{ marginTop: 6 }}
        >
          {busy && activeSave === "social" ? "Saving…" : "Save social links"}
        </button>
      </div>

      {/* Section 6: Account status (read-only) */}
      <div className="dx-card">
        <SectionHead
          title="Account status"
          sub="Read-only overview of your account and domain configuration."
        />
        <div className="dx-ff" style={{ flexWrap: "wrap" }}>
          <div className="dx-field">
            <label>Wallet balance</label>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {inrFromPaise(walletBalance)}
            </div>
            <p className="dx-muted" style={{ fontSize: 12, marginTop: 4 }}>
              Used for platform fees and SMS credits.{" "}
              <Link
                href="/dashboard/wallet"
                style={{ color: "var(--primary)", fontWeight: 600 }}
              >
                Recharge
              </Link>
            </p>
          </div>
          <div className="dx-field">
            <label>Custom domain</label>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                fontSize: 13.5,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {customDomain ?? primaryDomain ?? (
                <span className="dx-muted">No custom domain</span>
              )}
              {customDomain && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 6,
                    background: customDomainVerified
                      ? "color-mix(in srgb, var(--green, #22c55e) 14%, transparent)"
                      : "color-mix(in srgb, var(--primary) 12%, transparent)",
                    color: customDomainVerified
                      ? "var(--green, #22c55e)"
                      : "var(--primary)",
                  }}
                >
                  {customDomainVerified ? "Verified" : "Pending DNS"}
                </span>
              )}
            </div>
            <p className="dx-muted" style={{ fontSize: 12, marginTop: 4 }}>
              <Link
                href="/dashboard/domains"
                style={{ color: "var(--primary)", fontWeight: 600 }}
              >
                Manage domains
              </Link>
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
