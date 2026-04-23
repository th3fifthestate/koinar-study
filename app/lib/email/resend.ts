// app/lib/email/resend.ts
import { Resend } from "resend";
import { config } from "@/lib/config";
import {
  renderEmailShell,
  renderEmailButton,
  renderEmailCode,
  escape,
} from "@/lib/email/shell";

const resend = new Resend(config.email.resendApiKey);

export async function sendInviteEmail(options: {
  to: string;
  inviterName: string;
  inviteeName: string;
  studyTitle: string;
  inviteLink: string;
}): Promise<void> {
  const inviter = escape(options.inviterName);
  const invitee = escape(options.inviteeName);
  const study = escape(options.studyTitle);

  const html = renderEmailShell({
    previewText: `${options.inviterName} invited you to study ${options.studyTitle} on Koinar.`,
    body: `
      <p style="margin:0 0 16px 0;">Hi ${invitee},</p>
      <p style="margin:0 0 16px 0;">
        <strong style="font-weight:600;">${inviter}</strong> invited you to read
        <em style="font-style:italic;">${study}</em> together on Koinar —
        in-depth Bible study shared in real community.
      </p>
      <p style="margin:0 0 8px 0;">Tap below to join the study:</p>
      ${renderEmailButton({ href: options.inviteLink, label: "Join the study" })}
      <p style="margin:16px 0 0 0;font-size:14px;color:#5c564a;">
        If the button doesn't work, paste this link into your browser:<br />
        <a href="${options.inviteLink}" style="color:#5c564a;word-break:break-all;">${options.inviteLink}</a>
      </p>
    `,
  });

  const text =
    `Hi ${options.inviteeName},\n\n` +
    `${options.inviterName} invited you to read "${options.studyTitle}" together on Koinar — ` +
    `in-depth Bible study shared in real community.\n\n` +
    `Join the study: ${options.inviteLink}\n\n` +
    `— Koinar\nhello@koinar.app`;

  await resend.emails.send({
    from: "Koinar <noreply@koinar.app>",
    to: options.to,
    subject: `${options.inviterName} wants to study with you on Koinar`,
    html,
    text,
  });
}

export async function sendVerificationCode(options: {
  to: string;
  code: string;
}): Promise<void> {
  const html = renderEmailShell({
    previewText: `Your Koinar verification code is ${options.code}. It expires in 10 minutes.`,
    body: `
      <p style="margin:0 0 8px 0;">Your verification code is:</p>
      ${renderEmailCode(options.code)}
      <p style="margin:0;font-size:14px;color:#5c564a;">
        This code expires in 10 minutes. If you didn't request it, you can ignore this email.
      </p>
    `,
  });

  const text =
    `Your Koinar verification code is:\n\n` +
    `    ${options.code}\n\n` +
    `This code expires in 10 minutes. If you didn't request it, you can ignore this email.\n\n` +
    `— Koinar`;

  await resend.emails.send({
    from: "Koinar <noreply@koinar.app>",
    to: options.to,
    subject: `Your Koinar verification code: ${options.code}`,
    html,
    text,
  });
}

export async function sendAdminLoginCode(options: {
  to: string;
  code: string;
}): Promise<void> {
  await resend.emails.send({
    from: "Koinar <noreply@koinar.app>",
    to: options.to,
    subject: `Koinar admin sign-in code: ${options.code}`,
    html: `
      <p>An admin sign-in was just requested for this address.</p>
      <p>Your one-time code is:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;">${options.code}</p>
      <p style="color:#666;">This code expires in 10 minutes. If you didn't request this, you can ignore this email — no one can sign in without it.</p>
    `,
  });
}

export async function sendApprovalEmail(options: {
  to: string;
  name: string;
  registrationLink: string;
}): Promise<void> {
  const name = escape(options.name);

  const html = renderEmailShell({
    previewText: `Your request to join Koinar has been approved. Create your account to get started.`,
    body: `
      <p style="margin:0 0 16px 0;">${name},</p>
      <p style="margin:0 0 16px 0;">
        Your request to join Koinar has been approved. We're glad you're here.
      </p>
      <p style="margin:0 0 8px 0;">Create your account to get started:</p>
      ${renderEmailButton({ href: options.registrationLink, label: "Create your account" })}
      <p style="margin:16px 0 0 0;font-size:14px;color:#5c564a;">
        This link expires in 7 days. If it expires, reply to this email and we'll send a new one.
      </p>
    `,
  });

  const text =
    `${options.name},\n\n` +
    `Your request to join Koinar has been approved. We're glad you're here.\n\n` +
    `Create your account: ${options.registrationLink}\n\n` +
    `This link expires in 7 days. If it expires, reply to this email and we'll send a new one.\n\n` +
    `— Koinar`;

  await resend.emails.send({
    from: "Koinar <noreply@koinar.app>",
    to: options.to,
    subject: "Your request to join Koinar has been approved",
    html,
    text,
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
