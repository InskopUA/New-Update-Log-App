import Link from "next/link";
import { acceptInvite } from "@/lib/auth/actions";
import { roleLabel } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

type InviteDetails = {
  company_id: string;
  company_name: string;
  email: string;
  expires_at: string;
  id: string;
  role: string;
  status: string;
};

function getInvitePath(token: string) {
  return `/invite/${encodeURIComponent(token)}`;
}

function AuthLinks({ email, token }: { email: string; token: string }) {
  const next = getInvitePath(token);
  const signupParams = new URLSearchParams({
    email,
    next
  });

  return (
    <div className="form">
      <Link className="button button-primary button-full" href={`/signup?${signupParams.toString()}`}>
        Create / activate account
      </Link>
    </div>
  );
}

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const [{ data: userResult }, { data, error }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("get_invite_by_token", {
      invite_token: token
    })
  ]);

  const invite = (Array.isArray(data) ? data[0] : null) as InviteDetails | null;
  const user = userResult.user;
  const userEmail = user?.email?.toLowerCase() ?? "";
  const inviteEmail = invite?.email.toLowerCase() ?? "";
  const emailMatches = Boolean(userEmail && inviteEmail && userEmail === inviteEmail);

  if (error || !invite) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <p className="eyebrow">Team invite</p>
          <h1 className="page-title">Invite unavailable</h1>
          <p className="page-description">
            This invite link is invalid or no longer available.
          </p>
          <Link className="muted-link" href="/login">
            Go to sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Team invite</p>
        <h1 className="page-title">Join {invite.company_name}</h1>
        <p className="page-description">
          You were invited as {roleLabel(invite.role)}. This invite is for {invite.email}.
        </p>

        <Notice message={query.error} type="error" />
        <Notice message={query.message} />

        {invite.status !== "pending" ? (
          <>
            <Notice
              message={
                invite.status === "accepted"
                  ? "This invite has already been accepted."
                  : "This invite is expired or no longer active."
              }
              type="error"
            />
            <Link className="muted-link" href="/login">
              Go to sign in
            </Link>
          </>
        ) : null}

        {invite.status === "pending" && !user ? (
          <AuthLinks email={invite.email} token={token} />
        ) : null}

        {invite.status === "pending" && user && !emailMatches ? (
          <>
            <Notice
              message={`You are signed in as ${user.email}. This invite was sent to ${invite.email}. Sign out and use the invited email.`}
              type="error"
            />
            <Link className="muted-link" href="/dashboard">
              Go to dashboard
            </Link>
          </>
        ) : null}

        {invite.status === "pending" && user && emailMatches ? (
          <form action={acceptInvite} className="form">
            <input name="token" type="hidden" value={token} />
            <Button fullWidth type="submit">
              Accept invite
            </Button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
