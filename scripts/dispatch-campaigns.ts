import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalEnv() {
  try {
    const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");

    for (const line of envFile.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");

      process.env[key] ??= value;
    }
  } catch {
    // Environment variables may already be provided by the shell.
  }
}

async function main() {
  loadLocalEnv();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const internalSecret = process.env.INTERNAL_API_SECRET;

  if (!internalSecret) {
    throw new Error("INTERNAL_API_SECRET is required");
  }

  const response = await fetch(`${baseUrl}/api/campaigns/dispatch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": internalSecret,
    },
    body: JSON.stringify({}),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Dispatch failed with status ${response.status}: ${body}`);
  }

  console.log(body);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
