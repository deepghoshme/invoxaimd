"use client";

import { useTransition } from "react";
import { adminCancelCustomDomain, adminCancelExtraSubdomain } from "./actions";

type Props =
  | { kind: "custom"; domainId: string; domain: string; onDone?: () => void }
  | { kind: "extra"; subdomainId: string; subdomain: string; onDone?: () => void };

/**
 * Inline cancel button used inside the domains admin table.
 * Shows a browser-native confirm dialog before executing — deliberate, no
 * extra modal needed for a low-frequency admin operation.
 */
export default function DomainCancelButton(props: Props) {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (props.kind === "custom") {
      const label = props.domain;
      const confirmed = window.confirm(
        `Cancel custom domain "${label}"?\n\n` +
        `This will:\n` +
        `  · Remove the domain from the store\n` +
        `  · Revoke TLS cert approval (tls-check will return 403)\n` +
        `  · Reset the domain status to "pending"\n\n` +
        `The store itself is unaffected. This action is logged.`
      );
      if (!confirmed) return;
      startTransition(async () => {
        const res = await adminCancelCustomDomain(props.domainId);
        if (!res.ok) alert(`Cancel failed: ${res.error ?? "Unknown error"}`);
      });
    } else {
      const label = props.subdomain;
      const confirmed = window.confirm(
        `Cancel extra subdomain "${label}.invoxai.io"?\n\n` +
        `This will:\n` +
        `  · Permanently remove this subdomain from the store\n` +
        `  · Revoke TLS cert approval for this label\n\n` +
        `The primary subdomain and the store are unaffected. This action is logged.`
      );
      if (!confirmed) return;
      startTransition(async () => {
        const res = await adminCancelExtraSubdomain(props.subdomainId);
        if (!res.ok) alert(`Cancel failed: ${res.error ?? "Unknown error"}`);
      });
    }
  };

  return (
    <button
      type="button"
      className="btn"
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        padding: "3px 10px",
        color: "var(--red, #ef4444)",
        border: "1px solid color-mix(in srgb, var(--red, #ef4444) 40%, transparent)",
        background: "color-mix(in srgb, var(--red, #ef4444) 8%, transparent)",
        borderRadius: 7,
        cursor: pending ? "not-allowed" : "pointer",
        opacity: pending ? 0.6 : 1,
      }}
      onClick={handleClick}
      disabled={pending}
      title={pending ? "Cancelling…" : props.kind === "custom" ? `Cancel ${props.domain}` : `Cancel ${props.subdomain}.invoxai.io`}
    >
      {pending ? "…" : "Cancel"}
    </button>
  );
}
