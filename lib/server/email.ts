import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@rollmetric.com';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const verifyUrl = `${BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Roll Metrics Account</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #2563eb; margin-bottom: 10px;">Roll Metrics</h1>
    <p style="color: #666; margin: 0;">Your Brazilian Jiu-Jitsu Training Analytics</p>
  </div>
  
  <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
    <h2 style="color: #1f2937; margin-top: 0;">Verify Your Account</h2>
    <p style="margin-bottom: 20px;">Thanks for signing up! Please click the button below to verify your email address and start tracking your training sessions.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyUrl}" 
         style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
        Verify Email Address
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-bottom: 0;">
      Or copy and paste this link in your browser:<br>
      <span style="word-break: break-all;">${verifyUrl}</span>
    </p>
  </div>
  
  <div style="font-size: 12px; color: #888; text-align: center;">
    <p>This verification link expires in 24 hours.</p>
    <p>If you didn't create an account, you can safely ignore this email.</p>
  </div>
</body>
</html>`;

  const textContent = `
Roll Metrics - Verify Your Account

Thanks for signing up! Please verify your email address by visiting:
${verifyUrl}

This verification link expires in 24 hours.

If you didn't create an account, you can safely ignore this email.
`;

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: 'Verify your Roll Metrics account',
      html: htmlContent,
      text: textContent,
    });
    
    console.log(`Verification email sent to ${to}`);
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw new Error('EMAIL_SEND_FAILED');
  }
}

export async function sendSecurityAlert(
  to: string, 
  type: 'login' | 'password-change' | 'account-delete'
): Promise<void> {
  const subject = getSecurityAlertSubject(type);
  const { htmlContent, textContent } = getSecurityAlertContent(type);

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html: htmlContent,
      text: textContent,
    });
    
    console.log(`Security alert (${type}) sent to ${to}`);
  } catch (error) {
    console.error('Failed to send security alert:', error);
    // Don't throw error for security alerts - they're not critical
  }
}

function getSecurityAlertSubject(type: string): string {
  switch (type) {
    case 'login':
      return 'New login to your Roll Metrics account';
    case 'password-change':
      return 'Password changed on your Roll Metrics account';
    case 'account-delete':
      return 'Account deleted - Roll Metrics';
    default:
      return 'Security alert - Roll Metrics';
  }
}

function getSecurityAlertContent(type: string): { htmlContent: string; textContent: string } {
  const baseHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #2563eb; margin-bottom: 10px;">Roll Metrics</h1>
    <p style="color: #666; margin: 0;">Security Alert</p>
  </div>`;

  const footer = `
  <div style="font-size: 12px; color: #888; text-align: center; margin-top: 30px;">
    <p>If this wasn't you, please contact support immediately.</p>
    <p>This is an automated security notification.</p>
  </div>
</body>
</html>`;

  switch (type) {
    case 'login':
      return {
        htmlContent: baseHtml + `
  <div style="background: #fef3cd; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #92400e; margin-top: 0;">New Login Detected</h2>
    <p>A new login was detected on your Roll Metrics account at ${new Date().toLocaleString()}.</p>
    <p>If this was you, no action is needed. If you don't recognize this login, please secure your account immediately.</p>
  </div>` + footer,
        textContent: `Roll Metrics - New Login Detected\n\nA new login was detected on your account at ${new Date().toLocaleString()}.\n\nIf this wasn't you, please secure your account immediately.`
      };

    case 'password-change':
      return {
        htmlContent: baseHtml + `
  <div style="background: #dcfce7; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #166534; margin-top: 0;">Password Changed</h2>
    <p>Your password was successfully changed at ${new Date().toLocaleString()}.</p>
    <p>If you didn't make this change, please contact support immediately.</p>
  </div>` + footer,
        textContent: `Roll Metrics - Password Changed\n\nYour password was successfully changed at ${new Date().toLocaleString()}.\n\nIf you didn't make this change, please contact support immediately.`
      };

    case 'account-delete':
      return {
        htmlContent: baseHtml + `
  <div style="background: #fee2e2; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #dc2626; margin-top: 0;">Account Deleted</h2>
    <p>Your Roll Metrics account has been permanently deleted at ${new Date().toLocaleString()}.</p>
    <p>All your data has been removed from our systems.</p>
    <p>Thanks for using Roll Metrics!</p>
  </div>` + footer,
        textContent: `Roll Metrics - Account Deleted\n\nYour account has been permanently deleted at ${new Date().toLocaleString()}.\n\nAll your data has been removed from our systems.\n\nThanks for using Roll Metrics!`
      };

    default:
      return {
        htmlContent: baseHtml + `
  <div style="background: #fef3cd; border-radius: 8px; padding: 20px;">
    <p>Security activity detected on your account.</p>
  </div>` + footer,
        textContent: 'Roll Metrics - Security activity detected on your account.'
      };
  }
}