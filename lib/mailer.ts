import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";
import { formatMonthYear } from "./salary";

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

function emailHtml(params: SlipEmailParams): string {
  const period = formatMonthYear(params.monthYear);
  return `<!doctype html>
<html>
<body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#111827;color:#fff;border-radius:12px 12px 0 0;padding:24px 28px;">
      <h1 style="margin:0;font-size:18px;">${escapeHtml(env.companyName)}</h1>
      <p style="margin:6px 0 0;opacity:0.8;font-size:13px;">Payroll Department</p>
    </div>
    <div style="background:#fff;border-radius:0 0 12px 12px;padding:28px;border:1px solid #e5e7eb;border-top:none;">
      <p style="font-size:15px;margin:0 0 16px;">Dear ${escapeHtml(params.employeeName)},</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
        Please find attached your salary slip for <strong>${escapeHtml(period)}</strong>.
        The document is attached to this email as a PDF.
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.6;margin:0 0 16px;">
        🔒 <strong>This PDF is password protected.</strong><br/>
        The password is ${escapeHtml(params.passwordHint)}.
      </div>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
        If you have any questions about your salary slip, please contact the Payroll Department.
      </p>
      <p style="font-size:14px;margin:24px 0 0;">Regards,<br/>Payroll Team, ${escapeHtml(env.companyName)}</p>
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px;">
      This is an automated message. Please do not reply directly to this email.
    </p>
  </div>
</body>
</html>`;
}

export async function sendSlipEmail(params: SlipEmailParams): Promise<void> {
  const period = formatMonthYear(params.monthYear);
  await getTransporter().sendMail({
    from: env.smtp.from,
    to: params.to,
    subject: `Salary Slip — ${period}`,
    html: emailHtml(params),
    attachments: [
      {
        filename: `salary-slip-${params.monthYear}.pdf`,
        content: params.pdf,
        contentType: "application/pdf",
      },
    ],
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
