import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import type { Config } from "./config.js";
export async function resetEmail(
  config: Config,
  email: string,
  resetToken: string,
) {
  const url = `${config.origin}/accounts/reset/${resetToken}/`;
  const subject = "Reset your Gold Country Directory password";
  const text = `A password reset was requested for your Gold Country Directory account.\n\nOpen this link within one hour:\n${url}\n\nIf you did not request this, ignore this message.\n`;
  if (config.smtpUrl)
    await nodemailer
      .createTransport(config.smtpUrl)
      .sendMail({ from: config.smtpFrom, to: email, subject, text });
  else {
    await fs.mkdir(config.emailRoot, { recursive: true, mode: 0o700 });
    await fs.writeFile(
      path.join(config.emailRoot, `${Date.now()}-${randomUUID()}.json`),
      JSON.stringify({ to: email, subject, text }, null, 2),
      { mode: 0o600 },
    );
  }
}
