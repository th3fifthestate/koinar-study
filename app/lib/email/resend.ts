// app/lib/email/resend.ts
import { Resend } from "resend";
import { config } from "@/lib/config";

const resend = new Resend(config.email.resendApiKey);

export async function sendInviteEmail(options: {
  to: string;
  inviterName: string;
  inviteeName: string;
  studyTitle: string;
  inviteLink: string;
}): Promise<void> {
  await resend.emails.send({
    from: "Koinar <noreply@koinar.app>",
    to: options.to,
    subject: `${options.inviterName} wants to study with you`,
    html: `
      <p>Hi ${options.inviteeName},</p>
      <p>${options.inviterName} wants to study <strong>${options.studyTitle}</strong> with you on Koinar.</p>
      <p><a href="${options.inviteLink}" style="background:#4a5568;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Join the study</a></p>
      <p style="color:#666;font-size:14px;">This invitation was sent to you by a member of the Koinar community.</p>
    `,
  });
}

export async function sendVerificationCode(options: {
  to: string;
  code: string;
}): Promise<void> {
  await resend.emails.send({
    from: "Koinar <noreply@koinar.app>",
    to: options.to,
    subject: `Your Koinar verification code: ${options.code}`,
    html: `
      <p>Your verification code is:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;">${options.code}</p>
      <p style="color:#666;">This code expires in 10 minutes.</p>
    `,
  });
}

export async function sendApprovalEmail(options: {
  to: string;
  name: string;
  registrationLink: string;
}): Promise<void> {
  await resend.emails.send({
    from: "Koinar <noreply@koinar.app>",
    to: options.to,
    subject: "Your request to join Koinar has been approved",
    html: `
      <p>${options.name},</p>
      <p>Your request to join Koinar has been approved. We're glad you're here.</p>
      <p><a href="${options.registrationLink}" style="background:#4a5568;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Create Your Account</a></p>
      <p style="color:#666;font-size:14px;">This link expires in 7 days. If it expires, reach out and we'll send a new one.</p>
    `,
  });
}

export async function sendContactMessage(options: {
  topic: "feedback" | "bug" | "factcheck";
  subject: string;
  message: string;
  senderName: string;
  senderEmail: string;
  studyContext: string | null;
  authenticatedUserId: number | null;
  authenticatedUsername: string | null;
  ip: string;
}): Promise<void> {
  const topicLabel = {
    feedback: "General feedback",
    bug: "Bug report",
    factcheck: "Fact-check flag",
  }[options.topic];

  const memberLabel = options.authenticatedUserId
    ? `Member #${options.authenticatedUserId} (${options.authenticatedUsername ?? "unknown"})`
    : "Guest";

  const e = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  await resend.emails.send({
    from: "Koinar Contact <noreply@koinar.app>",
    to: "hello@koinar.app",
    replyTo: options.senderEmail,
    subject: `[${topicLabel}] ${options.subject}`,
    html: `
      <h2>${topicLabel}</h2>
      <p><strong>From:</strong> ${e(options.senderName)} &lt;${e(options.senderEmail)}&gt;</p>
      <p><strong>Account:</strong> ${e(memberLabel)}</p>
      ${options.studyContext ? `<p><strong>Study:</strong> ${e(options.studyContext)}</p>` : ""}
      <hr />
      <p><strong>Subject:</strong> ${e(options.subject)}</p>
      <p style="white-space: pre-wrap;">${e(options.message)}</p>
      <hr />
      <p style="color:#999;font-size:12px;">IP: ${e(options.ip)}</p>
    `,
  });
}
