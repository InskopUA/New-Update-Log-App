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

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: `${companyName} invited you to DeepTruck`,
      text: [
        `${companyName} invited you to join DeepTruck as ${role}.`,
        "",
        "Open this link to create your account and accept the invite:",
        inviteUrl
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
          <h1 style="font-size: 20px; margin: 0 0 12px;">Join ${safeCompanyName}</h1>
          <p style="margin: 0 0 20px;">
            You have been invited to DeepTruck as <strong>${safeRole}</strong>.
          </p>
          <a href="${safeInviteUrl}" style="background: #111827; color: #ffffff; display: inline-block; padding: 10px 14px; border-radius: 7px; text-decoration: none; font-weight: 700;">
            Accept invite
          </a>
          <p style="color: #64748b; font-size: 13px; margin: 20px 0 0;">
            If the button does not work, open this link:<br />
            <a href="${safeInviteUrl}" style="color: #111827;">${safeInviteUrl}</a>
          </p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || "Invite email could not be sent.");
  }
}
