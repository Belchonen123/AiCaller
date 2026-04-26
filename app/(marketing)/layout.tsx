import Link from "next/link";
import { ActualizerLogo } from "@/components/actualizer-logo";
import { Button } from "@/components/ui/button";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-bg-page">
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Actualizer home">
            <ActualizerLogo tagline />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-fg-secondary md:flex">
            <a href="#features" className="hover:text-fg-primary">Features</a>
            <a href="#pricing" className="hover:text-fg-primary">Pricing</a>
            <Link href="/login" className="hover:text-fg-primary">Sign in</Link>
          </nav>
          <Button render={<Link href="/signup" />} variant="accent">
            Create my agency account
          </Button>
        </div>
      </header>
      {children}
      <footer className="border-t border-border-subtle bg-bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-8">
          {[
            ["Product", "Features", "Pricing", "Templates"],
            ["Company", "About", "Customers", "Contact"],
            ["Resources", "Security", "HIPAA", "Michigan Home Help"],
            ["Legal", "Terms", "Privacy", "BAA"],
          ].map(([title, ...items]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold">{title}</h3>
              <ul className="mt-3 grid gap-2 text-sm text-fg-secondary">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-fg-primary">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border-subtle px-4 py-4 text-center text-xs text-fg-tertiary">
          © {new Date().getFullYear()} <ActualizerLogo variant="mono" className="inline" /> · Made for Michigan homecare
        </div>
      </footer>
    </div>
  );
}
