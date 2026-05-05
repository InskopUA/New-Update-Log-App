import { redirect } from "next/navigation";
import { createCompany } from "@/lib/auth/actions";
import { getAppContext } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

type OnboardingPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;
  const context = await getAppContext();

  if (context.activeMembership) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Workspace setup</p>
        <h1 className="page-title">Create your company</h1>
        <p className="page-description">
          This company becomes the account boundary for owners, admins, dispatchers,
          trucks, drivers, loads, and analytics.
        </p>

        <Notice message={params.error} type="error" />
        <Notice message={params.message} />

        <form action={createCompany} className="form">
          <label className="field">
            <span className="label">Company name</span>
            <input className="input" name="company_name" required type="text" />
          </label>
          <Button fullWidth type="submit">
            Create workspace
          </Button>
        </form>
      </section>
    </main>
  );
}
