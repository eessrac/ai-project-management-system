const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT || 465),
  secure: String(process.env.MAIL_SECURE || "true") === "true",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

async function sendMail({
  to,
  subject,
  html,
  text,
  fromName,
}) {
  if (!to) return null;

  const finalFromName = fromName || "PGT Proje Sistemi";
  const from = `"${finalFromName}" <${process.env.MAIL_USER}>`;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return info;
}

module.exports = {
  sendMail,
  transporter,
};