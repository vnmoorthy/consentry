// Consentry core types. Everything here is isomorphic: it runs in Node and in the browser.

export type CategoryId =
  | 'identity.name'
  | 'identity.dob'
  | 'identity.gov_id'
  | 'identity.employment'
  | 'contact.email'
  | 'contact.phone'
  | 'location.precise'
  | 'location.coarse'
  | 'health.condition'
  | 'health.medication'
  | 'health.allergy'
  | 'health.mental'
  | 'financial.card'
  | 'vehicle.vin'
  | 'inferred.health'
  | 'secret.credential';

/** Who receives data. Ordered roughly by trust. */
export type Tier = 'self' | 'llm' | 'public-sector' | 'open-data' | 'partner' | 'unknown';

export type Purpose =
  | 'lookup'
  | 'safety'
  | 'reservation'
  | 'transport'
  | 'payment'
  | 'fulfillment'
  | 'reasoning'
  | 'marketing'
  | 'unspecified';

export type Effect = 'allow' | 'deny' | 'ask' | 'minimize';

export type TransformId =
  | 'coarse-location'
  | 'neighborhood'
  | 'intersection'
  | 'alias'
  | 'virtual-card'
  | 'age-range'
  | 'first-name'
  | 'initials'
  | 'dietary-need'
  | 'generic-name'
  | 'redact'
  | 'token';

export interface VaultMeta {
  city?: string;
  state?: string;
  zip?: string;
  neighborhood?: string;
  intersection?: string;
  lat?: number;
  lon?: number;
  street?: string;
  first?: string;
  last?: string;
  dietary?: string;
  brand?: string;
}

export interface VaultItem {
  id: string;
  /** Stable slug used in tokens, e.g. {{vault:home_address}} */
  key: string;
  label: string;
  category: CategoryId;
  value: string;
  sensitivity: 1 | 2 | 3 | 4 | 5;
  /** Extra words that should be recognised as this item (e.g. brand names of a medication). */
  keywords?: string[];
  meta?: VaultMeta;
  createdAt: number;
  updatedAt: number;
}

/** Vault item as shown to UIs: the raw value is masked. */
export interface MaskedVaultItem extends Omit<VaultItem, 'value'> {
  masked: string;
  flows: number;
  lastSharedAt?: number;
}

export interface Recipient {
  id: string;
  name: string;
  domain: string;
  tier: Tier;
  description: string;
  /** Simulated partners are local mock services — labeled honestly in the UI. */
  simulated?: boolean;
  retention?: string;
  color?: string;
  emoji?: string;
}

export interface PolicyMatch {
  categories?: string[]; // CategoryId or prefix ('health') or '*'
  tiers?: Tier[];
  recipients?: string[]; // recipient ids
  purposes?: Purpose[];
}

export interface PolicyRule {
  id: string;
  title: string;
  match: PolicyMatch;
  effect: Effect;
  transform?: TransformId;
  priority: number;
  enabled: boolean;
  /** Hard rules cannot be overridden by grants or one-off consent. */
  hard?: boolean;
  source: 'default' | 'user' | 'grant';
  createdAt: number;
  expiresAt?: number;
  usesLeft?: number;
  hits?: number;
}

export interface PolicyDecision {
  effect: Effect;
  transform?: TransformId;
  rule?: PolicyRule;
  reason: string;
}

export type Detector = 'token' | 'vault' | 'pattern' | 'lexicon' | 'geo';

export interface Finding {
  id: string;
  path: string;
  category: CategoryId;
  itemId?: string;
  itemKey?: string;
  itemLabel?: string;
  /** The exact substring (or number) in the payload. */
  matched: string;
  /** The real value this match stands for (resolves tokens). */
  resolved: string;
  detector: Detector;
  confidence: number;
  start?: number;
  end?: number;
  numeric?: boolean;
}

export type Action = 'shared' | 'minimized' | 'withheld' | 'tokenized';

export interface FieldDecision {
  findingId: string;
  path: string;
  category: CategoryId;
  itemLabel?: string;
  effect: Effect;
  action: Action;
  before: string;
  after: string;
  ruleId?: string;
  ruleTitle?: string;
  transform?: TransformId;
  viaConsent?: boolean;
}

export type Verdict = 'clean' | 'allowed' | 'minimized' | 'consented' | 'blocked';

export interface ToolCall {
  id: string;
  tool: string;
  recipientId: string;
  purpose: Purpose;
  args: Record<string, unknown>;
  runId?: string;
  origin: 'agent' | 'gateway' | 'redteam';
  agentName?: string;
}

export interface EgressResult {
  verdict: Verdict;
  sanitizedArgs: Record<string, unknown>;
  findings: Finding[];
  decisions: FieldDecision[];
  blockedReason?: string;
  ledgerSeq?: number;
}

export interface Threat {
  id: string;
  kind: 'prompt-injection' | 'exfil-url' | 'hidden-text' | 'encoded-payload';
  score: number;
  severity: 'low' | 'medium' | 'high';
  excerpt: string;
  signals: string[];
  domains: string[];
}

export interface IngressResult {
  clean: boolean;
  score: number;
  threats: Threat[];
  sanitized: unknown;
  removed: number;
  ledgerSeq?: number;
}

export type ConsentDecision = 'allow_once' | 'allow_always' | 'minimize' | 'deny';

export interface ConsentItem {
  findingId: string;
  category: CategoryId;
  itemLabel: string;
  preview: string;
  minimizedPreview?: string;
  ruleTitle?: string;
}

export interface ConsentRequest {
  id: string;
  callId: string;
  runId?: string;
  tool: string;
  toolTitle: string;
  recipientId: string;
  recipientName: string;
  tier: Tier;
  purpose: Purpose;
  items: ConsentItem[];
  createdAt: number;
  expiresAt: number;
  agentName?: string;
}

export type LedgerKind = 'egress' | 'ingress' | 'consent' | 'policy' | 'grant' | 'revoke' | 'system' | 'llm';

export interface LedgerEntry {
  seq: number;
  ts: number;
  kind: LedgerKind;
  summary: string;
  runId?: string;
  tool?: string;
  recipientId?: string;
  purpose?: Purpose;
  verdict?: Verdict | 'quarantined' | 'clean' | string;
  categories?: CategoryId[];
  /** Masked field decisions — the ledger never stores raw personal data. */
  fields?: { path: string; category: CategoryId; item?: string; action: Action; after: string; ruleId?: string }[];
  ruleIds?: string[];
  /** SHA-256 of the canonical outbound payload, so an auditor can prove what was sent without storing it. */
  payloadDigest?: string;
  prevHash: string;
  hash: string;
}

export interface LedgerVerification {
  ok: boolean;
  checked: number;
  brokenAt?: number;
  expected?: string;
  found?: string;
  head?: string;
}

export interface ToolResultData {
  ok: boolean;
  data?: unknown;
  error?: string;
  /** A short human summary for the UI feed. */
  summary?: string;
}

export interface ToolContext {
  fetch: typeof fetch;
  signal?: AbortSignal;
  /** Red-team switches for the simulated partners. */
  scenario?: { poisonReviews?: boolean; imageExfil?: boolean };
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  recipientId: string;
  purpose: Purpose;
  /** JSON schema used for the LLM and for the gateway. */
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  /** Arguments that must survive the firewall, otherwise the call is blocked. */
  requiredArgs?: string[];
  endpoint: string;
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResultData>;
}

export interface Stats {
  inspected: number;
  shared: number;
  minimized: number;
  withheld: number;
  blocked: number;
  consentAsked: number;
  threats: number;
  tokenized: number;
}

export interface Settings {
  agentMode: 'autopilot' | 'claude';
  model: string;
  effort: 'low' | 'medium' | 'high';
  hasApiKey: boolean;
  keySource?: 'env' | 'user';
  compromisedAgent: boolean;
  consentTimeoutSec: number;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  runId?: string;
  ts: number;
}

export interface Receipt {
  runId: string;
  prompt: string;
  startedAt: number;
  endedAt: number;
  agent: 'autopilot' | 'claude' | 'compromised';
  calls: { tool: string; recipientId: string; verdict: Verdict }[];
  recipients: string[];
  shared: { label: string; category: CategoryId; recipientId: string; form: string }[];
  withheld: { label: string; category: CategoryId; recipientId: string; reason: string }[];
  threats: { kind: string; severity: string; recipientId: string }[];
  ledgerFrom: number;
  ledgerTo: number;
  headHash: string;
}

export type RuntimeEvent =
  | { type: 'run.start'; runId: string; prompt: string; agent: Receipt['agent']; ts: number }
  | { type: 'agent.step'; runId: string; text: string; ts: number }
  | { type: 'llm.egress'; runId: string; original: string; sanitized: string; decisions: FieldDecision[]; ts: number }
  | { type: 'tool.call'; runId?: string; callId: string; tool: string; toolTitle: string; recipientId: string; purpose: Purpose; args: Record<string, unknown>; origin: ToolCall['origin']; ts: number }
  | { type: 'firewall.egress'; runId?: string; callId: string; tool: string; recipientId: string; purpose: Purpose; result: EgressResult; ts: number }
  | { type: 'firewall.ingress'; runId?: string; callId: string; tool: string; recipientId: string; result: Omit<IngressResult, 'sanitized'>; ts: number }
  | { type: 'tool.result'; runId?: string; callId: string; tool: string; ok: boolean; summary: string; ms: number; ts: number }
  | { type: 'consent.request'; request: ConsentRequest; ts: number }
  | { type: 'consent.resolved'; id: string; decision: ConsentDecision; ts: number }
  | { type: 'agent.message'; runId: string; text: string; ts: number }
  | { type: 'run.end'; runId: string; receipt: Receipt; ts: number }
  | { type: 'ledger.append'; entry: LedgerEntry; ts: number }
  | { type: 'state.changed'; scope: 'vault' | 'policies' | 'recipients' | 'tools' | 'settings' | 'ledger' | 'all'; ts: number };

export interface PersistedState {
  version: number;
  vault: VaultItem[];
  policies: PolicyRule[];
  recipients: Recipient[];
  disabledTools: string[];
  settings: Omit<Settings, 'hasApiKey' | 'keySource'> & { apiKey?: string };
  stats: Stats;
  chat: ChatTurn[];
  receipts: Receipt[];
}

export interface Store {
  load(): Promise<PersistedState | null>;
  save(state: PersistedState): Promise<void>;
  loadLedger(): Promise<LedgerEntry[]>;
  appendLedger(entry: LedgerEntry): Promise<void>;
  replaceLedger(entries: LedgerEntry[]): Promise<void>;
}

export interface Snapshot {
  vault: MaskedVaultItem[];
  policies: PolicyRule[];
  recipients: Recipient[];
  tools: (Omit<ToolDef, 'run'> & { enabled: boolean; calls: number })[];
  stats: Stats;
  settings: Settings;
  pendingConsents: ConsentRequest[];
  ledger: { count: number; head: string };
  chat: ChatTurn[];
  receipts: Receipt[];
  privacyScore: number;
  mode: 'server' | 'local';
}
