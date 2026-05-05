import { headers } from "next/headers";
import Link from "next/link";
import { signUp } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

type SignupPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const headerStore = await headers();
  const host = headerStore.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const origin = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Owner account</p>
        <h1 className="page-title">Create account</h1>
        <p className="page-description">
          Start with one owner workspace. Dispatchers can be invited from settings.
        </p>

        <Notice message={params.error} type="error" />
        <Notice message={params.message} />

        <form action={signUp} className="form">
          <input name="origin" type="hidden" value={origin} />
          <input name="next" type="hidden" value={params.next ?? "/onboarding"} />
          <label className="field">
            <span className="label">Full name</span>
            <input className="input" name="full_name" required type="text" />
          </label>
          <label className="field">
            <span className="label">Email</span>
            <input className="input" name="email" required type="email" />
          </label>
          <label className="field">
            <span className="label">Password</span>
            <input className="input" minLength={6} name="password" required type="password" />
          </label>
          <Button fullWidth type="submit">
            Create account
          </Button>
        </form>

        <Link className="muted-link" href="/login">
          Already have an account
        </Link>
      </section>
    </main>
  );
}
