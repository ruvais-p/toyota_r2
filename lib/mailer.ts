import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";
import { formatMonthYear } from "./salary";
import { getLogoBuffer, LOGO_CID } from "./branding";

const globalForMail = globalThis as unknown as { __mailer?: Transporter };

export function getTransporter(): Transporter {
  if (!globalForMail.__mailer) {
    if (!env.smtp.host) {
      throw new Error(
        "SMTP is not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS in your environment."
      );
    }
    globalForMail.__mailer = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return globalForMail.__mailer;
}

/** Verify the SMTP connection/credentials. */
export async function verifySmtp(): Promise<void> {
  await getTransporter().verify();
}

interface SlipEmailParams {
  to: string;
  employeeName: string;
  monthYear: string;
  pdf: Buffer;
  passwordHint: string;
}

function pdfFilename(monthYear: string): string {
  return `salary-slip-${monthYear}.pdf`;
}

function emailHtml(params: SlipEmailParams): string {
  const period = formatMonthYear(params.monthYear);
  const company = escapeHtml(env.companyName);
  const year = new Date().getFullYear();
  const filename = pdfFilename(params.monthYear);
  const hasLogo = getLogoBuffer() !== null;

  const brand = hasLogo
    ? `<img src="cid:${LOGO_CID}" alt="${company}" height="34" style="display:block;height:34px;width:auto;border:0;outline:none;text-decoration:none;" />`
    : `<span style="font-size:18px;font-weight:bold;color:#0f172a;">${company}</span>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>Salary Slip — ${escapeHtml(period)}</title>
</head>
<body style="margin:0;padding:0;background:#eef0f4;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;-webkit-text-size-adjust:100%;">
  <!-- Preheader (hidden inbox preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#eef0f4;opacity:0;">
    Your salary slip for ${escapeHtml(period)} is attached as a password-protected PDF.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f4;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">

          <!-- Brand bar -->
          <tr><td style="height:4px;background:#c81e1e;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:24px 32px 20px;border-bottom:1px solid #eef0f2;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left">${brand}</td>
                  <td align="right" style="color:#94a3b8;font-size:11px;letter-spacing:0.6px;text-transform:uppercase;">Payroll Department</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:26px 32px 6px;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.2px;">Salary Slip</h1>
              <p style="margin:4px 0 0;color:#64748b;font-size:14px;">Pay period: <strong style="color:#0f172a;">${escapeHtml(period)}</strong></p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:18px 32px 8px;">
              <p style="margin:0 0 14px;font-size:14px;line-height:1.65;">Dear ${escapeHtml(params.employeeName)},</p>
              <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#334155;">
                Your salary slip for <strong>${escapeHtml(period)}</strong> has been generated and is
                attached to this email as a PDF document.
              </p>

              <!-- Attachment chip -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td valign="middle" style="font-size:20px;padding-right:12px;">📄</td>
                        <td valign="middle">
                          <div style="font-size:13.5px;font-weight:600;color:#0f172a;">${escapeHtml(filename)}</div>
                          <div style="font-size:11.5px;color:#64748b;margin-top:1px;">PDF document · password protected</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Password callout -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
                <tr>
                  <td style="background:#fef2f2;border:1px solid #fbd5d5;border-radius:10px;padding:14px 16px;">
                    <div style="font-size:13px;font-weight:700;color:#991b1b;margin-bottom:4px;">🔒 This PDF is password protected</div>
                    <div style="font-size:13px;line-height:1.6;color:#7f1d1d;">
                      The password is ${escapeHtml(params.passwordHint)}.
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 18px;font-size:13.5px;line-height:1.65;color:#334155;">
                If you have any questions about your salary slip, please contact the Payroll Department.
              </p>
              <p style="margin:0 0 4px;font-size:14px;line-height:1.6;">Regards,</p>
              <p style="margin:0;font-size:14px;line-height:1.6;font-weight:600;color:#0f172a;">Payroll Team · ${company}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 32px;border-top:1px solid #eef0f2;background:#fafbfc;">
              <p style="margin:0;font-size:11px;line-height:1.6;color:#94a3b8;">
                This is an automated message — please do not reply directly to this email.<br/>
                © ${year} ${company}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function emailText(params: SlipEmailParams): string {
  const period = formatMonthYear(params.monthYear);
  return [
    `Dear ${params.employeeName},`,
    "",
    `Your salary slip for ${period} has been generated and is attached to this email as a PDF (${pdfFilename(params.monthYear)}).`,
    "",
    `This PDF is password protected. The password is ${params.passwordHint}.`,
    "",
    "If you have any questions about your salary slip, please contact the Payroll Department.",
    "",
    "Regards,",
    `Payroll Team, ${env.companyName}`,
    "",
    "This is an automated message — please do not reply directly to this email.",
  ].join("\n");
}

export async function sendSlipEmail(params: SlipEmailParams): Promise<void> {
  const period = formatMonthYear(params.monthYear);
  const logo = getLogoBuffer();
  const attachments: Parameters<Transporter["sendMail"]>[0]["attachments"] = [
    {
      filename: pdfFilename(params.monthYear),
      content: params.pdf,
      contentType: "application/pdf",
    },
  ];
  if (logo) {
    // Inline logo referenced by the email header via cid:.
    attachments.push({
      filename: "logo.png",
      content: logo,
      contentType: "image/png",
      cid: LOGO_CID,
    });
  }
  await getTransporter().sendMail({
    from: env.smtp.from,
    to: params.to,
    subject: `Salary Slip — ${period}`,
    text: emailText(params),
    html: emailHtml(params),
    attachments,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
