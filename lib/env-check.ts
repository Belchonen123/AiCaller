import "server-only";

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANTHROPIC_API_KEY",
  "RETELL_API_KEY",
  "RETELL_WEBHOOK_SECRET",
] as const;

const recommendedEnv = [
  "RETELL_AGENT_ID",
  "NEXT_PUBLIC_APP_URL",
  "INTERNAL_API_SECRET",
  "CRON_SECRET",
] as const;

const placeholderMarkers = ["TODO", "PLACEHOLDER", "CHANGEME", "xxxxx"];

let hasLoggedEnvStatus = false;

function isMissing(value: string | undefined) {
  return !value || value.trim().length === 0;
}

function hasPlaceholder(value: string) {
  const normalized = value.toUpperCase();
  return placeholderMarkers.some((marker) => normalized.includes(marker.toUpperCase()));
}

export function checkRequiredEnv(): { missing: string[]; misconfigured: string[] } {
  const missing = [
    ...requiredEnv.filter((key) => isMissing(process.env[key])),
    ...recommendedEnv
      .filter((key) => isMissing(process.env[key]))
      .map((key) => `${key} (recommended)`),
  ];
  const misconfigured: string[] = [];

  const webhookSecret = process.env.RETELL_WEBHOOK_SECRET;
  if (webhookSecret && webhookSecret.length < 16) {
    misconfigured.push("RETELL_WEBHOOK_SECRET must be at least 16 characters.");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !appUrl.startsWith("https://")) {
    misconfigured.push("NEXT_PUBLIC_APP_URL must start with https://.");
  }

  for (const key of [...requiredEnv, ...recommendedEnv]) {
    const value = process.env[key];
    if (value && hasPlaceholder(value)) {
      misconfigured.push(`${key} contains a placeholder value.`);
    }
  }

  if (!hasLoggedEnvStatus && (missing.length > 0 || misconfigured.length > 0)) {
    const lines = [
      "Environment configuration needs attention.",
      missing.length ? `Missing: ${missing.join(", ")}` : null,
      misconfigured.length ? `Misconfigured: ${misconfigured.join(" ")}` : null,
    ].filter(Boolean);

    if (process.env.NODE_ENV === "production") {
      console.error(lines.join("\n"));
    } else {
      console.warn(lines.join("\n"));
    }

    hasLoggedEnvStatus = true;
  }

  return { missing, misconfigured };
}
