import type { CategoryId, Effect, PolicyDecision, PolicyMatch, PolicyRule, Purpose, Recipient, Tier, TransformId } from './types';
import { CATEGORIES, PURPOSES, TIERS, categoryMatches, categorySpecificity } from './taxonomy';
import { uid } from './util';

const RESTRICTIVENESS: Record<Effect, number> = { deny: 3, ask: 2, minimize: 1, allow: 0 };

export interface PolicyQuery {
  category: CategoryId;
  recipient: Recipient;
  purpose: Purpose;
}

export function ruleMatches(rule: PolicyRule, q: PolicyQuery, now = Date.now()): boolean {
  if (!rule.enabled) return false;
  if (rule.expiresAt && rule.expiresAt < now) return false;
  if (rule.usesLeft !== undefined && rule.usesLeft <= 0) return false;
  const m = rule.match;
  if (m.categories?.length && !m.categories.some((c) => categoryMatches(c, q.category))) return false;
  if (m.tiers?.length && !m.tiers.includes(q.recipient.tier)) return false;
  if (m.recipients?.length && !m.recipients.includes(q.recipient.id)) return false;
  if (m.purposes?.length && !m.purposes.includes(q.purpose)) return false;
  return true;
}

function specificity(m: PolicyMatch): number {
  const cat = Math.max(0, ...(m.categories ?? ['*']).map(categorySpecificity));
  return (m.recipients?.length ? 8 : 0) + (m.tiers?.length ? 4 : 0) + (m.purposes?.length ? 2 : 0) + cat;
}

/**
 * Highest priority wins. Ties go to the more specific rule, then the more restrictive one.
 * The user's self is always allowed: Consentry never blocks data from flowing back to you.
 */
export function evaluate(rules: PolicyRule[], q: PolicyQuery, now = Date.now()): PolicyDecision {
  if (q.recipient.tier === 'self') return { effect: 'allow', reason: 'Stays on your device' };
  const candidates = rules.filter((r) => ruleMatches(r, q, now));
  if (!candidates.length) return { effect: 'ask', reason: 'No rule covers this — asking you' };
  candidates.sort((a, b) => b.priority - a.priority || specificity(b.match) - specificity(a.match) || RESTRICTIVENESS[b.effect] - RESTRICTIVENESS[a.effect]);
  const rule = candidates[0];
  return { effect: rule.effect, transform: rule.transform, rule, reason: rule.title };
}

/** Explains every rule that matched, in the order they were considered — powers the policy simulator. */
export function explain(rules: PolicyRule[], q: PolicyQuery, now = Date.now()) {
  const matched = rules
    .filter((r) => ruleMatches(r, q, now))
    .sort((a, b) => b.priority - a.priority || specificity(b.match) - specificity(a.match) || RESTRICTIVENESS[b.effect] - RESTRICTIVENESS[a.effect]);
  return { decision: evaluate(rules, q, now), matched };
}

// ───────────────────────────── Plain-English → policy ─────────────────────────────

const CATEGORY_WORDS: [RegExp, string[]][] = [
  [/\b(mental[- ]health|therapy|therapist|psychiatr\w*|anxiety|depression)\b/i, ['health.mental']],
  [/\b(allerg\w*|dietary|diet)\b/i, ['health.allergy']],
  [/\b(medication|medications|meds|prescriptions?|drugs?)\b/i, ['health.medication']],
  [/\b(conditions?|diagnos\w*)\b/i, ['health.condition']],
  [/\b(health|medical)\b/i, ['health']],
  [/\b(exact (address|location)|address|home|where i live|gps|precise location|location|whereabouts)\b/i, ['location.precise']],
  [/\b(city|zip|zipcode|postal code|approximate location)\b/i, ['location.coarse']],
  [/\b(e-?mail)\b/i, ['contact.email']],
  [/\b(phone|number to call|mobile|cell)\b/i, ['contact.phone']],
  [/\b(contact info|contact details|contact)\b/i, ['contact']],
  [/\b(ssn|social security|passport|government id|driver'?s licen[cs]e|national id)\b/i, ['identity.gov_id']],
  [/\b(birthday|date of birth|dob|age)\b/i, ['identity.dob']],
  [/\b(my name|full name|name)\b/i, ['identity.name']],
  [/\b(employer|job|workplace|where i work)\b/i, ['identity.employment']],
  [/\b(card|credit card|debit card|payment|bank|financial)\b/i, ['financial.card']],
  [/\b(vin|car|vehicle)\b/i, ['vehicle.vin']],
  [/\b(passwords?|api keys?|tokens?|secrets?|credentials?)\b/i, ['secret.credential']],
  [/\b(anything|everything|all (of )?my (data|info\w*)|personal (data|info\w*)|my data)\b/i, ['*']],
];

const TIER_WORDS: [RegExp, Tier[]][] = [
  [/\b(commercial|compan(y|ies)|partners?|businesses|apps?|merchants?|brands?|advertisers?|third[- ]part(y|ies))\b/i, ['partner']],
  [/\b(government|gov|public[- ]sector|federal|agencies)\b/i, ['public-sector']],
  [/\b(open[- ]data|weather|maps?|public data|public apis?)\b/i, ['open-data', 'public-sector']],
  [/\b(ai|llm|model|claude|chatbot|language model)\b/i, ['llm']],
  [/\b(unknown|unverified|untrusted|random sites?|sketchy)\b/i, ['unknown']],
];

const PURPOSE_WORDS: [RegExp, Purpose][] = [
  [/\b(reservations?|bookings?|book(ing)? a table|restaurants?)\b/i, 'reservation'],
  [/\b(rides?|taxi|uber|lyft|transport\w*|pick ?ups?|drop ?offs?)\b/i, 'transport'],
  [/\b(pay(ing|ments?)?|checkout|purchases?|buying)\b/i, 'payment'],
  [/\b(deliver(y|ies)|refills?|orders?|shipping)\b/i, 'fulfillment'],
  [/\b(recalls?|safety|alerts?|emergenc(y|ies))\b/i, 'safety'],
  [/\b(marketing|ads?|advertising|promotions?)\b/i, 'marketing'],
];

const TRANSFORM_WORDS: [RegExp, TransformId][] = [
  [/\b(city|approximate|rough|coarse|general area|~?10 ?km)\b/i, 'coarse-location'],
  [/\b(neighbou?rhood)\b/i, 'neighborhood'],
  [/\b(intersection|corner|nearby street)\b/i, 'intersection'],
  [/\b(alias|relay|masked?|burner)\b/i, 'alias'],
  [/\b(virtual card|single[- ]use|one[- ]time card)\b/i, 'virtual-card'],
  [/\b(age range|age bracket|just my age)\b/i, 'age-range'],
  [/\b(first name)\b/i, 'first-name'],
  [/\b(initials)\b/i, 'initials'],
];

export interface CompiledPolicy {
  rule: PolicyRule;
  confidence: number;
  explanation: string;
  understood: string[];
}

export function compilePolicy(text: string, recipients: Recipient[], now = Date.now()): CompiledPolicy {
  const t = ' ' + text.trim() + ' ';
  const understood: string[] = [];

  // Effect
  let effect: Effect = 'ask';
  if (/\b(never|don'?t|do not|block|deny|forbid|stop|no one|nobody|refuse|prevent)\b/i.test(t)) effect = 'deny';
  else if (/\b(ask|check with me|confirm|prompt me|approval|approve)\b/i.test(t)) effect = 'ask';
  else if (/\b(only (share|give|send)|only my|just my|approximate|mask|alias|relay|instead of|rather than|virtual|age range|initials|first name|neighbou?rhood|intersection)\b/i.test(t)) effect = 'minimize';
  else if (/\b(always|allow|ok to|okay to|fine to|can (share|see|get|have)|may (share|see|get)|share|let)\b/i.test(t)) effect = 'allow';

  // Categories
  let categories: string[] = [];
  for (const [re, cats] of CATEGORY_WORDS) if (re.test(t)) categories.push(...cats);
  categories = [...new Set(categories)];
  if (categories.includes('*')) categories = ['*'];
  if (categories.includes('health')) categories = categories.filter((c) => !c.startsWith('health.') || c === 'health.mental');
  if (categories.includes('contact')) categories = categories.filter((c) => !c.startsWith('contact.'));
  if (!categories.length) categories = ['*'];

  // Recipients by name
  const named = recipients.filter((r) => r.id !== 'unknown' && new RegExp(`\\b${r.name.split(/[ (]/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t));
  // Tiers
  let tiers: Tier[] = [];
  for (const [re, ts] of TIER_WORDS) if (re.test(t)) tiers.push(...ts);
  tiers = [...new Set(tiers)];
  if (/\b(anyone|everyone|anybody|any app|anywhere)\b/i.test(t) && !named.length) tiers = [];

  // Purposes
  const purposes: Purpose[] = [];
  for (const [re, p] of PURPOSE_WORDS) if (re.test(t) && !purposes.includes(p)) purposes.push(p);

  // Exceptions: "never share X with partners except for reservations" → the exception becomes its own (higher) rule later.
  const exceptMatch = /\b(except|unless|but not)\b(.*)$/i.exec(t);
  let purposesFinal = purposes;
  if (exceptMatch && effect === 'deny') {
    purposesFinal = purposes.filter((p) => !new RegExp(PURPOSE_WORDS.find(([, pp]) => pp === p)![0].source, 'i').test(exceptMatch[2]));
    understood.push('Exceptions noted — add a separate "allow" rule for them');
  }

  // Transform
  let transform: TransformId | undefined;
  for (const [re, tr] of TRANSFORM_WORDS) if (re.test(t)) { transform = tr; break; }
  if (effect === 'minimize' && !transform) transform = categories[0]?.startsWith('location') ? 'coarse-location' : categories[0]?.startsWith('contact') ? 'alias' : 'redact';
  if (effect !== 'minimize' && effect !== 'ask') transform = undefined;

  // Duration
  let expiresAt: number | undefined;
  const dur = /\bfor (?:the next )?(\d+|an?|one)\s*(minute|hour|day|week|month)s?\b/i.exec(t);
  if (dur) {
    const n = /^\d+$/.test(dur[1]) ? parseInt(dur[1], 10) : 1;
    const unit = { minute: 60e3, hour: 3600e3, day: 86400e3, week: 7 * 86400e3, month: 30 * 86400e3 }[dur[2].toLowerCase() as 'day'];
    expiresAt = now + n * unit;
  } else if (/\b(today|tonight)\b/i.test(t)) {
    const d = new Date(now);
    d.setHours(23, 59, 59, 999);
    expiresAt = d.getTime();
  }

  const match: PolicyMatch = { categories };
  if (named.length) match.recipients = named.map((r) => r.id);
  else if (tiers.length) match.tiers = tiers;
  if (purposesFinal.length) match.purposes = purposesFinal;

  // Priority: user rules outrank defaults (but never hard lines). Deny beats allow at equal specificity.
  const priority = 800 + (match.recipients ? 40 : 0) + (match.purposes ? 20 : 0) + (effect === 'deny' ? 10 : 0);

  const catLabel = categories[0] === '*' ? 'any personal data' : categories.map((c) => (CATEGORIES as any)[c]?.label ?? c.replace(/^\w/, (x) => x.toUpperCase())).join(', ');
  const who = match.recipients ? named.map((r) => r.name).join(', ') : match.tiers ? match.tiers.map((x) => TIERS[x].label).join(' / ') : 'anyone';
  understood.unshift(`Data: ${catLabel}`, `Recipient: ${who}`, `Effect: ${effect}${transform ? ` (${transform})` : ''}`);
  if (match.purposes) understood.push(`Purpose: ${match.purposes.map((p) => PURPOSES[p]).join(', ')}`);
  if (expiresAt) understood.push(`Expires: ${new Date(expiresAt).toLocaleString()}`);

  const signals = (categories[0] !== '*' ? 1 : 0) + (match.recipients || match.tiers ? 1 : 0) + (effect !== 'ask' || /\bask\b/i.test(t) ? 1 : 0);
  const confidence = Math.min(0.98, 0.45 + signals * 0.17 + (match.purposes ? 0.05 : 0));

  const rule: PolicyRule = {
    id: uid('p_'),
    title: text.trim().replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase()).replace(/([^.!?])$/, '$1.'),
    match,
    effect,
    transform,
    priority,
    enabled: true,
    source: 'user',
    createdAt: now,
    expiresAt,
    hits: 0,
  };
  return { rule, confidence, explanation: understood.join(' · '), understood };
}

export function describeRule(rule: PolicyRule, recipients: Recipient[]): string {
  const cats = (rule.match.categories ?? ['*']).map((c) => (c === '*' ? 'any data' : (CATEGORIES as any)[c]?.label ?? c)).join(', ');
  const who = rule.match.recipients?.length
    ? rule.match.recipients.map((id) => recipients.find((r) => r.id === id)?.name ?? id).join(', ')
    : rule.match.tiers?.length
      ? rule.match.tiers.map((t) => TIERS[t].label).join(' / ')
      : 'anyone';
  const why = rule.match.purposes?.length ? ` for ${rule.match.purposes.map((p) => PURPOSES[p].toLowerCase()).join(', ')}` : '';
  return `${cats} → ${who}${why}`;
}

export function makeGrant(q: PolicyQuery, ttlMs: number, now = Date.now()): PolicyRule {
  return {
    id: uid('g_'),
    title: `Allowed: ${CATEGORIES[q.category].label} → ${q.recipient.name} for ${PURPOSES[q.purpose].toLowerCase()}`,
    match: { categories: [q.category], recipients: [q.recipient.id], purposes: [q.purpose] },
    effect: 'allow',
    priority: 900,
    enabled: true,
    source: 'grant',
    createdAt: now,
    expiresAt: now + ttlMs,
    hits: 0,
  };
}
