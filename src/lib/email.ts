import { Resend } from 'resend';
import { PermissionLevel } from '@/types/timeline';

export interface CollaboratorInviteOptions {
  to: string;
  inviterName?: string;
  inviterEmail?: string;
  timelineTitle: string;
  timelineSlug: string;
  permission: PermissionLevel;
  origin?: string;
}

export interface EmailSendResult {
  success: boolean;
  simulated?: boolean;
  id?: string;
  error?: string;
}

/**
 * Generate a responsive, branded HTML email for collaborator invitations
 */
export function generateCollaboratorInviteEmailHtml(options: {
  inviterName: string;
  timelineTitle: string;
  timelineUrl: string;
  permission: PermissionLevel;
}): string {
  const { inviterName, timelineTitle, timelineUrl, permission } = options;
  const isEditor = permission === 'editor';
  const roleLabel = isEditor ? 'Editor (Can edit)' : 'Viewer (Read-only)';
  const roleColor = isEditor ? '#059669' : '#2563EB';
  const roleBg = isEditor ? '#ECFDF5' : '#EFF6FF';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to collaborate on ${timelineTitle}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #F8F9FA;
      margin: 0;
      padding: 32px 16px;
      color: #1F2937;
    }
    .email-wrapper {
      max-width: 540px;
      margin: 0 auto;
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #111827 0%, #1F2937 100%);
      padding: 28px 32px;
      text-align: left;
    }
    .logo-badge {
      display: inline-block;
      background: #F59E0B;
      color: #0F172A;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 6px;
    }
    .content {
      padding: 32px;
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      color: #111827;
      margin: 0 0 12px 0;
      line-height: 1.3;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #4B5563;
      margin: 0 0 20px 0;
    }
    .timeline-card {
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 14px;
      padding: 18px 20px;
      margin: 20px 0 28px 0;
    }
    .timeline-title {
      font-size: 16px;
      font-weight: 800;
      color: #111827;
      margin-bottom: 6px;
    }
    .role-badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      color: ${roleColor};
      background: ${roleBg};
      padding: 4px 10px;
      border-radius: 8px;
    }
    .cta-button {
      display: block;
      background: #F59E0B;
      color: #0F172A !important;
      font-size: 14px;
      font-weight: 800;
      text-decoration: none;
      text-align: center;
      padding: 14px 28px;
      border-radius: 12px;
      margin: 24px 0 16px 0;
      transition: background-color 0.2s ease;
    }
    .footer {
      border-top: 1px solid #F3F4F6;
      padding: 20px 32px;
      font-size: 12px;
      color: #9CA3AF;
      line-height: 1.5;
      text-align: center;
    }
    .footer a {
      color: #D97706;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="header">
      <span class="logo-badge">Weekline</span>
    </div>
    <div class="content">
      <h1>You're invited to collaborate</h1>
      <p>
        <strong>${inviterName}</strong> has invited you to collaborate on their sprint timeline.
      </p>

      <div class="timeline-card">
        <div class="timeline-title">${timelineTitle}</div>
        <div class="role-badge">Role: ${roleLabel}</div>
      </div>

      <a href="${timelineUrl}" class="cta-button" target="_blank" rel="noopener noreferrer">
        Open Timeline &rarr;
      </a>

      <p style="font-size: 12px; color: #6B7280; margin-bottom: 0;">
        If you don't have a Weekline account yet, simply sign up with this email to access and edit your assigned tasks.
      </p>
    </div>
    <div class="footer">
      This invitation was sent from <a href="${timelineUrl}">Weekline</a>. If you were not expecting this, you can safely ignore this email.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send collaborator invitation email via Resend (with simulation fallback)
 */
export async function sendCollaboratorInviteEmail(
  options: CollaboratorInviteOptions
): Promise<EmailSendResult> {
  const {
    to,
    inviterName = 'A team member',
    timelineTitle,
    timelineSlug,
    permission,
    origin,
  } = options;

  if (!to || !to.includes('@')) {
    return { success: false, error: 'Invalid recipient email address' };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Weekline <onboarding@resend.dev>';
  const baseUrl = origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const timelineUrl = `${baseUrl.replace(/\/$/, '')}/t/${timelineSlug}`;

  const html = generateCollaboratorInviteEmailHtml({
    inviterName,
    timelineTitle,
    timelineUrl,
    permission,
  });

  const subject = `${inviterName} invited you to collaborate on "${timelineTitle}"`;

  // Fallback: If RESEND_API_KEY is not set or is dummy placeholder, simulate dispatch
  if (!apiKey || apiKey.startsWith('re_123456789') || apiKey === 'your-resend-api-key') {
    console.log(
      `\x1b[33m[Email Service: Simulated]\x1b[0m Invitation would be sent to: ${to} for "${timelineTitle}" (${timelineUrl})`
    );
    return {
      success: true,
      simulated: true,
      id: `sim-${Date.now()}`,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
    });

    if (result.error) {
      console.error('[Email Service] Resend error:', result.error);
      return {
        success: false,
        error: result.error.message,
      };
    }

    return {
      success: true,
      simulated: false,
      id: result.data?.id,
    };
  } catch (error: any) {
    console.error('[Email Service] Failed to send email:', error);
    return {
      success: false,
      error: error.message || 'Unknown email delivery failure',
    };
  }
}
