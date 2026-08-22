import { describe, it, expect } from 'vitest';
import {
  generateCollaboratorInviteEmailHtml,
  sendCollaboratorInviteEmail,
} from '../lib/email';

describe('Resend Email Service & Invitation Templates', () => {
  it('generates a branded HTML invitation email with correct details', () => {
    const html = generateCollaboratorInviteEmailHtml({
      inviterName: 'Alice Designer',
      timelineTitle: 'Q4 Product Roadmap',
      timelineUrl: 'http://localhost:3000/t/q4-roadmap',
      permission: 'editor',
    });

    expect(html).toContain('Weekline');
    expect(html).toContain('Alice Designer');
    expect(html).toContain('Q4 Product Roadmap');
    expect(html).toContain('http://localhost:3000/t/q4-roadmap');
    expect(html).toContain('Editor (Can edit)');
    expect(html).toContain('Open Timeline &rarr;');
  });

  it('renders Viewer badge for viewer permission', () => {
    const html = generateCollaboratorInviteEmailHtml({
      inviterName: 'Bob Manager',
      timelineTitle: 'Client Review Timeline',
      timelineUrl: 'https://weekline.app/t/client-review',
      permission: 'viewer',
    });

    expect(html).toContain('Viewer (Read-only)');
    expect(html).toContain('https://weekline.app/t/client-review');
  });

  it('rejects invalid recipient email addresses', async () => {
    const result = await sendCollaboratorInviteEmail({
      to: 'invalid-email',
      timelineTitle: 'Sprint 1',
      timelineSlug: 'sprint-1',
      permission: 'editor',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid recipient email');
  });

  it('falls back to simulation mode without crashing when RESEND_API_KEY is not configured', async () => {
    // Ensure simulated mode
    const prevKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    const result = await sendCollaboratorInviteEmail({
      to: 'collaborator@example.com',
      inviterName: 'Lead Dev',
      timelineTitle: 'Sprint 12 Alpha',
      timelineSlug: 'sprint-12-alpha',
      permission: 'editor',
      origin: 'http://localhost:3000',
    });

    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.id).toBeDefined();

    // Restore key if any
    if (prevKey) process.env.RESEND_API_KEY = prevKey;
  });
});
