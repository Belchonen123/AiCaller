"use client";

import { useState } from "react";
import { CopyIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type CopyButtonProps = {
  value: string;
  label?: string;
};

export function CopyButton({ value, label = "Copy" }: CopyButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        toast.success("Copied to clipboard.");
      }}
    >
      <CopyIcon />
      {label}
    </Button>
  );
}

function generateSecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export function GenerateSecretButton() {
  const [secret, setSecret] = useState("");

  return (
    <div className="grid gap-2 rounded-lg border border-border-subtle bg-bg-surface-sunken p-3">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-fit"
        onClick={() => setSecret(generateSecret())}
      >
        <RefreshCwIcon />
        Generate secret
      </Button>
      {secret ? (
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-bg-surface px-2 py-1 font-mono text-xs">
            {secret}
          </code>
          <CopyButton value={secret} />
        </div>
      ) : null}
    </div>
  );
}
