import { headers } from "next/headers";
import { createTeamInvite, revokeTeamInvite } from "@/lib/auth/actions";
import { getAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canManageTeam, roleLabel } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

type TeamPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

type TeamMember = {
  id: string;
  role: string;
  status: string;
  profile: {
    email: string | null;
    full_name: string | null;
  } | null;
};

type TeamInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  created_at: string;
};

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const params = await searchParams;
  const headerStore = await headers();
  const context = await getAppContext();
  const supabase = await createClient();
  const companyId = context.activeMembership?.company.id;
  const canInvite = canManageTeam(context.activeMembership?.role);
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_APP_URL ?? "";

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("company_members")
      .select("id, role, status, profile:profiles(email, full_name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
    supabase
      .from("company_invites")
      .select("id, email, role, status, token, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
  ]);

  return (
    <>
      <PageHeader
        description="Manage who can access this company workspace."
        title="Team"
      />

      <Notice message={params.error} type="error" />
      <Notice message={params.message} />

      {canInvite ? (
        <Panel title="Invite dispatcher">
          <form action={createTeamInvite} className="form" style={{ marginTop: 0 }}>
            <input name="company_id" type="hidden" value={companyId} />
            <div className="grid grid-3">
              <label className="field">
                <span className="label">Email</span>
                <input className="input" name="email" required type="email" />
              </label>
              <label className="field">
                <span className="label">Role</span>
                <select className="select" defaultValue="dispatcher" name="role">
                  <option value="dispatcher">Dispatcher</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
              <div className="field" style={{ justifyContent: "end" }}>
                <Button type="submit">Create invite</Button>
              </div>
            </div>
          </form>
        </Panel>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <Panel title="Members">
          {(members as unknown as TeamMember[] | null)?.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(members as unknown as TeamMember[]).map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div>{member.profile?.full_name ?? "Unnamed user"}</div>
                      <div className="stat-note">{member.profile?.email}</div>
                    </td>
                    <td>{roleLabel(member.role)}</td>
                    <td>
                      <span className="badge">{member.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">No members found.</div>
          )}
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title="Invites">
          {(invites as TeamInvite[] | null)?.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Invite link</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(invites as TeamInvite[]).map((invite) => (
                  <tr key={invite.id}>
                    <td>{invite.email}</td>
                    <td>{roleLabel(invite.role)}</td>
                    <td>
                      <span className="badge">{invite.status}</span>
                    </td>
                    <td>
                      {invite.status === "pending" ? (
                        <a className="muted-link" href={`${origin}/invite/${invite.token}`}>
                          Open link
                        </a>
                      ) : (
                        <span className="stat-note">Unavailable</span>
                      )}
                    </td>
                    <td>
                      {invite.status === "pending" && canInvite ? (
                        <form action={revokeTeamInvite}>
                          <input name="invite_id" type="hidden" value={invite.id} />
                          <input name="company_id" type="hidden" value={companyId} />
                          <Button type="submit" variant="secondary">
                            Cancel
                          </Button>
                        </form>
                      ) : (
                        <span className="stat-note">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">No invites yet.</div>
          )}
        </Panel>
      </div>
    </>
  );
}
