"use client";

import { useState } from "react";
import Link from "next/link";

export interface CustomerListItem {
  email: string;
  id: string; // encodeURIComponent(email)
  name: string;
  lifetimeSpend: string; // formatted string
  initial: string;
}

export default function CustomerList({
  customers,
  selectedId,
}: {
  customers: CustomerListItem[];
  selectedId: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.email.toLowerCase().includes(query.toLowerCase()),
      )
    : customers;

  return (
    <aside className="cr-list">
      <div className="cr-search">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          placeholder="Search customers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          {query ? "No customers match." : "No customers yet."}
        </div>
      )}

      {filtered.map((c) => (
        <Link
          key={c.id}
          href={`/dashboard/customers/${c.id}`}
          className={`cr-row${c.id === selectedId ? " on" : ""}`}
        >
          <span className="cr-av">{c.initial}</span>
          <div>
            <div className="nm">{c.name}</div>
            <div className="em">{c.email}</div>
          </div>
          <span className="sp">{c.lifetimeSpend}</span>
        </Link>
      ))}
    </aside>
  );
}
