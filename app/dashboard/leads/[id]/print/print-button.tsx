"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      className="rounded border border-neutral-900 px-3 py-1 text-sm font-medium print:hidden"
      onClick={() => window.print()}
    >
      Print this page
    </button>
  );
}
