import type { Recipient, ToolDef } from '../types';
import { PUBLIC_TOOLS } from './public';
import { PARTNER_TOOLS } from './partners';

export const ALL_TOOLS: ToolDef[] = [...PUBLIC_TOOLS, ...PARTNER_TOOLS];

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
