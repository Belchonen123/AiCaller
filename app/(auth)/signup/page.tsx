import { ActualizerLogo } from "@/components/actualizer-logo";
import { SignupValuePanel } from "@/app/(auth)/auth-panels";
import { SignupForm } from "@/app/(auth)/signup/signup-form";

export default function SignupPage() {
  return (
    <main className="grid min-h-svh bg-bg-page lg:grid-cols-[60fr_40fr]">
      <section className="flex min-h-svh flex-col px-6 py-6">
        <ActualizerLogo markClassName="size-8 bg-accent-primary" />
        <div className="flex flex-1 items-center justify-center py-10">
          <SignupForm />
        </div>
      </section>
      <div className="hidden lg:block">
        <SignupValuePanel />
      </div>
      <div className="px-6 pb-6 lg:hidden">
        <SignupValuePanel />
      </div>
    </main>
  );
}
