import type { Recipient, ToolDef } from '../types';
import { PUBLIC_TOOLS } from './public';
import { PARTNER_TOOLS } from './partners';

/** Runs on-device: drafts a CCPA/GDPR deletion request from the ledger. No network call. */
export const requestDeletion: ToolDef = {
  name: 'request_data_deletion',
  title: 'Draft deletion request',
  description: 'Draft a CCPA/GDPR request asking a partner company (TableTap, RideNow, MediMart, BiteFinder, QuickQuote) to delete everything it received about the user, citing the consent ledger. Runs on-device; the user sends it from the Footprint page.',
  recipientId: 'self',
  purpose: 'unspecified',
  endpoint: 'local',
  requiredArgs: ['company'],
  inputSchema: { type: 'object', properties: { company: { type: 'string', description: 'Partner name, e.g. "TableTap"' } }, required: ['company'] },
  async run(args, ctx) {
    if (!ctx.local) return { ok: false, error: 'Not available here', summary: 'Not available' };
    try {
      const r = await ctx.local.draftDeletion(String(args.company ?? ''));
      return { ok: true, data: { company: r.recipientName, to: r.to, subject: r.subject, evidence_entries: r.evidence.map((e) => e.seq), status: r.status, letter_preview: r.letter.split('\n').slice(0, 9).join('\n') }, summary: `Drafted for ${r.recipientName} · cites ${r.evidence.length} entries` };
    } catch (err: any) {
      return { ok: false, error: err.message, summary: err.message };
    }
  },
};

export const ALL_TOOLS: ToolDef[] = [...PUBLIC_TOOLS, ...PARTNER_TOOLS, requestDeletion];

export function getTool(name: string): ToolDef | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}

/** Resolve who actually receives a call. For http_fetch that's whoever owns the URL. */
export function resolveRecipient(tool: ToolDef, args: Record<string, unknown>, recipients: Recipient[]): Recipient {
  if (tool.recipientId !== 'dynamic') return recipients.find((r) => r.id === tool.recipientId) ?? recipients.find((r) => r.id === 'unknown')!;
  let host = '';
  try {
    host = new URL(String(args.url ?? '')).hostname.toLowerCase();
  } catch {
    /* not a URL */
  }
  const known = recipients.find((r) => r.domain !== '*' && host && (host === r.domain || host.endsWith('.' + r.domain) || r.domain.endsWith('.' + host)));
  if (known) return known;
  const unknown = recipients.find((r) => r.id === 'unknown')!;
  return { ...unknown, name: host || 'Unknown destination', domain: host || '*' };
}

export { PUBLIC_TOOLS, PARTNER_TOOLS };
export * from './public';
export * from './partners';
