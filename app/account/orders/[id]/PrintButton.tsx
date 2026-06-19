"use client";

/**
 * PrintButton — triggers window.print() for the printable receipt.
 * Client component so it can use onClick / window APIs.
 */
export default function PrintButton() {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() => window.print()}
    >
      Print receipt
    </button>
  );
}
