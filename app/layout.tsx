import type { Metadata } from "next";
import { cookies } from "next/headers";
import { IBM_Plex_Sans, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { checkRequiredEnv } from "@/lib/env-check";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Actualizer",
  description: "AI-assisted healthcare intake and lead management.",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Actualizer",
    description: "AI intake infrastructure for healthcare teams.",
    images: ["/opengraph-image"],
  },
};

const themeScript = `
(() => {
  try {
    const match = document.cookie.match(/(?:^|; )actualizer-theme=([^;]+)/);
    const preference = match ? decodeURIComponent(match[1]) : "system";
    const theme = preference === "light" || preference === "dark"
      ? preference
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.themePreference = "system";
  }
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  checkRequiredEnv();

  const cookieStore = await cookies();
  const themePreference = cookieStore.get("actualizer-theme")?.value ?? "system";
  const safeThemePreference = ["light", "dark", "system"].includes(themePreference)
    ? themePreference
    : "system";

  return (
    <html
      lang="en"
      data-theme={safeThemePreference}
      data-theme-preference={safeThemePreference}
      suppressHydrationWarning
      className={`${inter.variable} ${ibmPlexSans.variable} ${jetBrainsMono.variable} font-sans antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-svh flex-col bg-bg-page text-fg-primary">
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
