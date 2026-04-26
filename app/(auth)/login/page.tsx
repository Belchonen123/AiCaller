import { ActualizerLogo } from "@/components/actualizer-logo";
import { LoginTrustPanel } from "@/app/(auth)/auth-panels";
import { LoginForm } from "@/app/(auth)/login/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-svh bg-bg-page lg:grid-cols-[60fr_40fr]">
      <section className="flex min-h-svh flex-col px-6 py-6">
        <ActualizerLogo markClassName="size-8 bg-accent-primary" />
        <div className="flex flex-1 items-center justify-center py-10">
          <LoginForm />
        </div>
        <div className="lg:hidden">
          <LoginTrustPanel mobile />
        </div>
      </section>
      <div className="hidden lg:block">
        <LoginTrustPanel />
      </div>
    </main>
  );
}
