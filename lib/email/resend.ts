type SendInviteEmailParams = {
  companyName: string;
  email: string;
  inviteUrl: string;
  role: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendInviteEmail({
  companyName,
  email,
  inviteUrl,
  role
}: SendInviteEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("Invite email service is not configured.");
  }

  const safeCompanyName = escapeHtml(companyName);
  const safeInviteUrl = escapeHtml(inviteUrl);
  const safeRole = escapeHtml(role);
  const subjectCompanyName = companyName.trim() || "DeepTruck";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: `Join ${subjectCompanyName} on DeepTruck`,
      text: [
        `${companyName} invited you to join DeepTruck as ${role}.`,
        "",
        "Open this link to create your account and accept the invite:",
        inviteUrl
      ].join("\n"),
      html: `
        <!doctype html>
        <html>
          <body style="margin:0; padding:0; background:#f4f7fb; font-family:Inter, Arial, sans-serif; color:#111827;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb; padding:32px 16px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px; background:#ffffff; border:1px solid #dbe5f0; border-radius:12px; overflow:hidden;">
                    <tr>
                      <td style="padding:32px;">
                        <div style="font-size:12px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#64748b;">
                          DeepTruck Workspace Invite
                        </div>

                        <h1 style="margin:14px 0 12px; font-size:30px; line-height:1.15; color:#0f172a;">
                          Join ${safeCompanyName}
                        </h1>

                        <p style="margin:0 0 22px; font-size:16px; line-height:1.6; color:#475569;">
                          You have been invited to DeepTruck as <strong>${safeRole}</strong>. Accept the invite to open the workspace and start working with daily reports, action items, maintenance logs, and fleet risk signals.
                        </p>

                        <a href="${safeInviteUrl}"
                           style="display:inline-block; background:#111827; color:#ffffff; text-decoration:none; font-size:15px; font-weight:800; padding:14px 20px; border-radius:8px;">
                          Accept invite
                        </a>

                        <div style="margin-top:24px; padding:14px 16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                          <p style="margin:0; font-size:13px; line-height:1.5; color:#64748b;">
                            If the button does not work, copy and paste this link into your browser:
                          </p>
                          <p style="margin:8px 0 0; font-size:12px; line-height:1.5; color:#2563eb; word-break:break-all;">
                            ${safeInviteUrl}
                          </p>
                        </div>

                        <p style="margin:24px 0 0; font-size:13px; line-height:1.6; color:#64748b;">
                          This invite is tied to <strong>${escapeHtml(email)}</strong>. If you create a new account, DeepTruck may ask you to confirm your email before joining the workspace.
                        </p>

                        <p style="margin:28px 0 0; font-size:12px; line-height:1.5; color:#94a3b8;">
                          If you were not expecting this invite, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="margin:18px 0 0; font-size:12px; color:#94a3b8;">
                    DeepTruck · Fleet operations intelligence
                  </p>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || "Invite email could not be sent.");
  }
}
