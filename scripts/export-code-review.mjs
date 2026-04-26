import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const outputFile = "FULL_APP_CODE_REVIEW.md";
const textExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mjs",
  ".cjs",
  ".css",
  ".sql",
  ".svg",
  ".txt",
  ".csv",
  ".yml",
  ".yaml",
  ".toml",
]);
const includedFilenames = new Set([
  ".gitignore",
  "vercel.json",
  "components.json",
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "middleware.ts",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "pnpm-workspace.yaml",
]);
const binaryExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".mp3",
  ".mp4",
  ".wav",
  ".mov",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
]);

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function shouldInclude(filePath) {
  const normalized = normalizePath(filePath);
  const basename = path.basename(normalized);
  const extension = path.extname(normalized).toLowerCase();

  if (normalized === outputFile || normalized === "EXTERNAL_CODE_REVIEW.md") {
    return false;
  }

  if (
    normalized.startsWith(".git/") ||
    normalized.startsWith(".next/") ||
    normalized.startsWith("node_modules/") ||
    normalized.startsWith("coverage/") ||
    normalized.startsWith("out/") ||
    normalized.startsWith("build/")
  ) {
    return false;
  }

  if (
    basename === "next-env.d.ts" ||
    basename.endsWith(".tsbuildinfo") ||
    basename.endsWith("-lock.yaml") ||
    basename === "package-lock.json" ||
    basename === "yarn.lock"
  ) {
    return false;
  }

  if (basename.startsWith(".env") && basename !== ".env.local.example") {
    return false;
  }

  if (binaryExtensions.has(extension)) {
    return false;
  }

  return includedFilenames.has(basename) || textExtensions.has(extension);
}

function languageFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return (
    {
      ".ts": "ts",
      ".tsx": "tsx",
      ".js": "js",
      ".jsx": "jsx",
      ".json": "json",
      ".md": "md",
      ".mjs": "js",
      ".cjs": "js",
      ".css": "css",
      ".sql": "sql",
      ".svg": "xml",
      ".yml": "yaml",
      ".yaml": "yaml",
      ".csv": "csv",
    }[extension] ?? "text"
  );
}

function collectFiles(directory = ".") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = normalizePath(path.join(directory, entry.name));

    if (entry.isDirectory()) {
      if (
        [".git", ".next", "node_modules", "coverage", "out", "build"].includes(entry.name)
      ) {
        return [];
      }

      return collectFiles(filePath);
    }

    if (!entry.isFile()) {
      return [];
    }

    return shouldInclude(filePath) ? [filePath] : [];
  });
}

const files = collectFiles().sort((a, b) => a.localeCompare(b));

let output = `# Full App Code Review Bundle

Generated for external code review on ${new Date().toISOString()}. Secrets and generated/dependency files are intentionally excluded.

## Exclusions

- \`.env.local\` and other secret env files
- \`node_modules/\`, \`.next/\`, build/cache output
- lockfiles and TypeScript build info
- binary assets such as images, audio, video, PDFs, archives
- prior review bundle files

## Included Files (${files.length})

${files.map((file) => `- \`${file}\``).join("\n")}
`;

for (const file of files) {
  const contents = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
  output += `

## File: \`${file}\`

\`\`\`\`${languageFor(file)}
${contents}
\`\`\`\`
`;
}

writeFileSync(outputFile, output, "utf8");
console.log(`Wrote ${outputFile} with ${files.length} files and ${output.length} characters.`);
