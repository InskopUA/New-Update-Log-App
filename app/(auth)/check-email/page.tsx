import Link from "next/link";
import { Notice } from "@/components/ui/notice";

type CheckEmailPageProps = {
  searchParams: Promise<{
    email?: string;
    message?: string;
    next?: string;
  }>;
};

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
  const params = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Email confirmation</p>
        <h1 className="page-title">Check your email</h1>
        <p className="page-description">
          Open the confirmation link we sent to {params.email ?? "your email"}. After
          confirmation, you will return to the invite automatically.
        </p>

        <Notice message={params.message} />

        <Link className="muted-link" href={params.next ?? "/login"}>
          Return to invite
        </Link>
      </section>
    </main>
  );
}
