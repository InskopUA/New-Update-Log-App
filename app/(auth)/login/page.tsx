import Link from "next/link";
import { signIn } from "@/lib/auth/actions";
import { Notice } from "@/components/ui/notice";
import { Button } from "@/components/ui/button";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">SaaS Foundation</p>
        <h1 className="page-title">Sign in</h1>
        <p className="page-description">
          Use your email and password to access your company workspace.
        </p>

        <Notice message={params.error} type="error" />
        <Notice message={params.message} />

        <form action={signIn} className="form">
          <input name="next" type="hidden" value={params.next ?? "/dashboard"} />
          <label className="field">
            <span className="label">Email</span>
            <input className="input" name="email" required type="email" />
          </label>
          <label className="field">
            <span className="label">Password</span>
            <input className="input" minLength={6} name="password" required type="password" />
          </label>
          <Button fullWidth type="submit">
            Sign in
          </Button>
        </form>

        <Link className="muted-link" href="/signup">
          Create an owner account
        </Link>
      </section>
    </main>
  );
}
