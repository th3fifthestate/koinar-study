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

export async function sendPasswordResetEmail(options: {
  to: string;
  displayName: string;
  resetLink: string;
}): Promise<void> {
  const name = escape(options.displayName);

  const html = renderEmailShell({
    previewText: `Reset your Koinar password. This link expires in 30 minutes.`,
    body: `
      <p style="margin:0 0 16px 0;">Hi ${name},</p>
      <p style="margin:0 0 16px 0;">
        We received a request to reset the password on your Koinar account.
        Tap below to choose a new one:
      </p>
      ${renderEmailButton({ href: options.resetLink, label: "Reset your password" })}
      <p style="margin:16px 0 0 0;font-size:14px;color:#5c564a;">
        This link expires in 30 minutes and can only be used once. If the
        button doesn't work, paste this link into your browser:<br />
        <a href="${options.resetLink}" style="color:#5c564a;word-break:break-all;">${options.resetLink}</a>
      </p>
      <p style="margin:16px 0 0 0;font-size:14px;color:#5c564a;">
        If you didn't request this, you can ignore this email — your password
        won't change until you click the link and set a new one.
      </p>
    `,
  });

  const text =
    `Hi ${options.displayName},\n\n` +
    `We received a request to reset the password on your Koinar account.\n\n` +
    `Reset your password: ${options.resetLink}\n\n` +
    `This link expires in 30 minutes and can only be used once.\n\n` +
    `If you didn't request this, you can ignore this email — your password ` +
    `won't change until you click the link and set a new one.\n\n` +
    `— Koinar`;

  await resend.emails.send({
    from: "Koinar <noreply@koinar.app>",
    to: options.to,
    subject: "Reset your Koinar password",
    html,
    text,
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
        This link expires in 7 days. If it expires, write hello@koinar.app and we'll send a new one.
      </p>
    `,
  });

  const text =
    `${options.name},\n\n` +
    `Your request to join Koinar has been approved. We're glad you're here.\n\n` +
    `Create your account: ${options.registrationLink}\n\n` +
    `This link expires in 7 days. If it expires, write hello@koinar.app and we'll send a new one.\n\n` +
    `— Koinar`;

  await resend.emails.send({
    from: "Koinar <noreply@koinar.app>",
    to: options.to,
    subject: "Your request to join Koinar has been approved",
    html,
    text,
  });
}

// Notification email the admin sends when a pre-assigned gift code is
// already pinned to a user's account. The credits are already redeemable
// on /generate — this mail just tells the user they're there. Deliberately
// does NOT carry the raw code string, because the code is unnecessary to
// the user (it's already linked to their account) and exposing it in plain
// email widens the blast radius if the inbox is compromised.
export async function sendGiftCodeNotification(options: {
  to: string;
  displayName: string;
  formatLabel: string; // e.g. "Standard"
  credits: number; // remaining count at time of send
  generateLink: string; // absolute URL to /generate
}): Promise<void> {
  const name = escape(options.displayName);
  const format = escape(options.formatLabel);
  const plural = options.credits === 1 ? "credit" : "credits";

  const html = renderEmailShell({
    previewText: `You have ${options.credits} ${format} study ${plural} ready on Koinar.`,
    body: `
      <p style="margin:0 0 16px 0;">Hi ${name},</p>
      <p style="margin:0 0 16px 0;">
        You have <strong style="font-weight:600;">${options.credits} ${format} study ${plural}</strong>
        ready to use on Koinar. No code to enter — we've already linked them
        to your account.
      </p>
      <p style="margin:0 0 8px 0;">Start a study whenever you're ready:</p>
      ${renderEmailButton({ href: options.generateLink, label: "Begin a study" })}
      <p style="margin:16px 0 0 0;font-size:14px;color:#5c564a;">
        If the button doesn't work, paste this link into your browser:<br />
        <a href="${options.generateLink}" style="color:#5c564a;word-break:break-all;">${options.generateLink}</a>
      </p>
    `,
  });

  const text =
    `Hi ${options.displayName},\n\n` +
    `You have ${options.credits} ${options.formatLabel} study ${plural} ready to use on Koinar. ` +
    `No code to enter — we've already linked them to your account.\n\n` +
    `Start a study: ${options.generateLink}\n\n` +
    `— Koinar\nhello@koinar.app`;

  await resend.emails.send({
    from: "Koinar <noreply@koinar.app>",
    to: options.to,
    subject: `Your ${options.formatLabel} study ${plural} are ready on Koinar`,
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
