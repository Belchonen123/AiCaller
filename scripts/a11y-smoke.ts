import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const baseUrl = process.env.A11Y_BASE_URL ?? "http://localhost:3000";
const routes = (process.env.A11Y_ROUTES ?? "/,/login,/signup").split(",");

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  let failed = false;

  for (const route of routes) {
    const url = new URL(route.trim(), baseUrl).toString();
    await page.goto(url, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (results.violations.length) {
      failed = true;
      process.stderr.write(`\n${url}\n`);
      for (const violation of results.violations) {
        process.stderr.write(`- ${violation.id}: ${violation.help}\n`);
        for (const node of violation.nodes.slice(0, 3)) {
          process.stderr.write(`  ${node.target.join(", ")}\n`);
        }
      }
    } else {
      process.stdout.write(`✓ ${url}\n`);
    }
  }

  await context.close();
  await browser.close();

  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    error instanceof Error
      ? `${error.message}\n`
      : "Accessibility smoke test failed.\n"
  );
  process.exit(1);
});
