import type { Threat } from './types';
import { truncate, uid } from './util';

/**
 * Prompt-injection & exfiltration scanner for tool *responses*. Tool output is untrusted data:
 * anything in it that talks to the model like an operator is a red flag.
 */
interface Signal {
  id: string;
  label: string;
  re: RegExp;
  weight: number;
  kind: Threat['kind'];
}

const SIGNALS: Signal[] = [
  { id: 'override', label: 'Tries to override prior instructions', re: /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|your)\b[^.\n]{0,20}\b(instructions?|prompts?|rules?|guidelines?)/i, weight: 0.9, kind: 'prompt-injection' },
  { id: 'addressing-ai', label: 'Addresses the AI agent directly', re: /\b(ai|llm) (assistant|agent|model)s?\b[\s:,]|\bdear (assistant|agent)\b|\bas an ai\b|\battention,? (ai|assistant|agent)\b/i, weight: 0.55, kind: 'prompt-injection' },
  { id: 'role-spoof', label: 'Spoofs a system / developer message', re: /(^|\n|<!--|\[)\s*(system|developer|assistant)\s*(message|prompt|note)?\s*[:\]]/i, weight: 0.6, kind: 'prompt-injection' },
  { id: 'exfil-ask', label: 'Asks for sensitive data to be sent somewhere', re: /\b(send|forward|post|upload|transmit|include|append|attach|share|provide|submit)\b[^.\n]{0,80}\b(ssn|social security|password|card number|credit card|cvv|api key|token|home address|date of birth|passport|medical|full card)\b/i, weight: 0.85, kind: 'prompt-injection' },
  { id: 'tool-steer', label: 'Steers the agent to call a tool', re: /\b(call|invoke|use|run|execute)\b[^.\n]{0,20}\b(the )?(tool|function|http_fetch|fetch_url|api)\b/i, weight: 0.45, kind: 'prompt-injection' },
  { id: 'secrecy', label: 'Asks the agent to hide actions from the user', re: /\b(do not|don'?t|never)\b[^.\n]{0,20}\b(tell|inform|mention|show|notify|reveal to)\b[^.\n]{0,15}\b(the )?(user|human|customer|them)\b|\bwithout (telling|informing|asking) (the )?(user|human)\b|\bsilently\b/i, weight: 0.8, kind: 'prompt-injection' },
  { id: 'urgency-authority', label: 'Fake urgency or authority', re: /\b(mandatory|required by law|compliance requirement|security verification|verify (your|the user'?s) identity|account will be (suspended|closed))\b/i, weight: 0.35, kind: 'prompt-injection' },
  { id: 'md-image-exfil', label: 'Zero-click exfiltration via image URL', re: /!\[[^\]]*\]\(\s*https?:\/\/[^)\s]+\?[^)\s]*=/i, weight: 0.8, kind: 'exfil-url' },
  { id: 'templated-url', label: 'URL with a slot for your data', re: /https?:\/\/[^\s"'<>)]+[?&][a-z_]+=\s*(\{[^}]+\}|<[^>]+>|\[[^\]]+\]|\$\{?[a-z_]+)/i, weight: 0.7, kind: 'exfil-url' },
  { id: 'hidden-text', label: 'Hidden zero-width / invisible characters', re: /[​-‍⁠﻿‪-‮]/, weight: 0.6, kind: 'hidden-text' },
  { id: 'html-comment', label: 'Instructions hidden in an HTML comment', re: /<!--[\s\S]{12,}?-->/, weight: 0.3, kind: 'hidden-text' },
  { id: 'base64-blob', label: 'Large encoded blob', re: /\b[A-Za-z0-9+/]{80,}={0,2}/, weight: 0.25, kind: 'encoded-payload' },
];

const URL_RE = /https?:\/\/([a-z0-9.-]+\.[a-z]{2,})(?::\d+)?[^\s"'<>)]*/gi;

export interface ScanResult {
  score: number;
  threats: Threat[];
  sanitizedText: string;
  removed: number;
}

/** Noisy-OR combination: several weak signals add up to a strong one. */
function combine(weights: number[]): number {
  return 1 - weights.reduce((acc, w) => acc * (1 - w), 1);
}

export function scanText(text: string, knownDomains: string[] = []): ScanResult {
  const hits = SIGNALS.filter((s) => s.re.test(text));
  const score = combine(hits.map((h) => h.weight));
  if (!hits.length || score < 0.4) return { score, threats: [], sanitizedText: text, removed: 0 };

  const domains = [...text.matchAll(URL_RE)].map((m) => m[1].toLowerCase()).filter((d) => !knownDomains.some((k) => d === k || d.endsWith('.' + k)));
  const severity: Threat['severity'] = score >= 0.8 ? 'high' : score >= 0.6 ? 'medium' : 'low';

  // Find the most suspicious span for the excerpt.
  const commentMatch = /<!--([\s\S]*?)-->/.exec(text);
  let excerpt = '';
  if (commentMatch && SIGNALS.some((s) => s.id !== 'html-comment' && s.re.test(commentMatch[1]))) excerpt = commentMatch[1].trim();
  else {
    const sentence = text.split(/(?<=[.!?\n])\s+/).find((s) => hits.some((h) => h.id !== 'hidden-text' && h.re.test(s)));
    excerpt = (sentence ?? text).trim();
  }

  const primary = hits.slice().sort((a, b) => b.weight - a.weight)[0];
  const threat: Threat = {
    id: uid('t_'),
    kind: primary.kind,
    score: Math.round(score * 100) / 100,
    severity,
    excerpt: truncate(excerpt.replace(/[​-‍⁠﻿]/g, '').replace(/\s+/g, ' '), 320),
    signals: hits.map((h) => h.label),
    domains: [...new Set(domains)],
  };

  // Quarantine: strip comments, hidden chars, suspicious sentences and exfil images.
  let removed = 0;
  let sanitized = text
    .replace(/<!--[\s\S]*?-->/g, () => (removed++, ''))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, () => (removed++, ''))
    .replace(/[​-‍⁠﻿‪-‮]/g, '');
  const parts = sanitized.split(/(?<=[.!?\n])\s+/);
  sanitized = parts
    .filter((p) => {
      const bad = SIGNALS.some((s) => s.weight >= 0.45 && s.kind !== 'hidden-text' && s.re.test(p));
      if (bad) removed++;
      return !bad;
    })
    .join(' ');
  if (removed) sanitized = sanitized.trim() + ' [Consentry removed suspected injected instructions]';
  return { score, threats: [threat], sanitizedText: sanitized.trim(), removed };
}

/** Scan every string in a JSON value, returning a sanitized deep copy. */
export function scanPayload(payload: unknown, knownDomains: string[] = []): { score: number; threats: Threat[]; sanitized: unknown; removed: number } {
  const threats: Threat[] = [];
  let maxScore = 0;
  let removed = 0;
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      if (node.length < 24) return node;
      const r = scanText(node, knownDomains);
      maxScore = Math.max(maxScore, r.score);
      threats.push(...r.threats);
      removed += r.removed;
      return r.threats.length ? r.sanitizedText : node;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, walk(v)]));
    return node;
  };
  const sanitized = walk(payload);
  return { score: maxScore, threats, sanitized, removed };
}
