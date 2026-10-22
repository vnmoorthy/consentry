# Consentry architecture

<img src="../assets/architecture.png" alt="Architecture" width="100%" />

## Design goals

1. **One choke point.** Every byte that leaves (to a tool, a partner, an MCP server or the LLM) passes through `ConsentryRuntime.callTool()` or `inspectLLMText()`. There is no side door.
2. **Don't trust the model.** Enforcement lives outside the model. The red-team suite includes a *simulated compromised agent* that obeys injected instructions; the firewall must hold anyway.
3. **Field-level, not request-level.** A booking request can share your name, alias your phone, virtual-card your card and withhold your SSN, all in one call.
4. **Explainable.** Every decision names the rule that made it, and every rule can be simulated.
5. **Provable.** Decisions are hash-chained. The ledger stores masked values and payload digests, never raw personal data.
6. **Isomorphic.** The same TypeScript core runs in Node (gateway) and the browser (local-first). The live demo has no backend.

## Components

| Component | File | Responsibility |
|---|---|---|
| Types & taxonomy | `packages/core/src/types.ts`, `taxonomy.ts` | 16 data categories, 6 recipient tiers, 9 purposes |
| Detector | `detect.ts` | Finds personal data in any JSON payload |
| Policy engine | `policy.ts` | Evaluates rules, explains matches, compiles plain English, mints grants |
| Minimizers | `transforms.ts` | 12 reversible-for-you, irreversible-for-them transforms |
| Firewall | `firewall.ts` | Egress inspection + consent + rewrite + default-deny; ingress quarantine; LLM tokenization |
| Injection scanner | `injection.ts` | 12 weighted signals combined with noisy-OR; sanitizes payloads |
| Ledger | `ledger.ts` | Append-only SHA-256 chain over canonical JSON; serialized appends |
| Agents | `planner.ts` (Autopilot), `llm.ts` (Claude) | Plan and call tools *only via the runtime* |
| Runtime | `runtime.ts` | Orchestration, consent queue, events, receipts, stats, persistence |
| Tools | `tools/public.ts`, `tools/partners.ts` | 12 live public APIs, 5 simulated partners, 1 generic fetch |
| Gateway | `apps/server` | Hono REST + SSE, SQLite ledger, AES-256-GCM encrypted vault & chat |
| Dashboard | `apps/web` | React 19, Tailwind v4, Framer Motion; server or local-first client |
| MCP bridge | `apps/mcp` | stdio MCP server that forwards to the gateway |

## Detection

Personal data is found by five detectors, in priority order:

| Detector | Example | Notes |
|---|---|---|
| **Token** | `{{vault:home_location}}` | Agents are told to use tokens; the firewall resolves them |
| **Vault fingerprint** | `Maya Rivera`, `(415) 555-0142`, `April 12, 1991` | Normalized digit matching for phones, cards and SSNs; multiple date formats; street fragments; ZIP as coarse location; user-defined keywords (brand names) |
| **Geo-proximity** | `37.7612,-122.4148` or `{lat, lon}` | Anything within 350 m of a saved place counts as precise. Minimized coordinates (1–2 decimals) fall outside the radius, so they're never re-flagged |
| **Pattern + checksum** | any SSN, Luhn-valid card, email, phone, API key | Catches data that *isn't* in the vault (a pasted card, a stranger's SSN) |
| **Health lexicon** | `peanut`, `insulin`, `sertraline` | Query terms can reveal health status. Flagged as `inferred.health` |

Overlapping matches are de-duplicated by detector strength, then span length. Values that Consentry itself generated (relay aliases, virtual cards) are registered so they're never flagged again.

## Policy evaluation

```
candidates = enabled ∧ ¬expired rules matching (category prefix, tier, recipient, purpose)
winner     = argmax(priority) → most specific (recipient > tier > purpose > category depth) → most restrictive (deny > ask > minimize > allow)
```

Priority bands: **hard lines 980–1000** (can't be disabled) · grants 900 · user rules 800–870 · defaults 0–700.

Effects:
- **allow**: send the real value
- **minimize**: send the transform output (rule-specified or a sensible default per data type)
- **ask**: pause the agent and show a consent prompt (one per call, covering every field that needs it)
- **deny**: replace with `[withheld by Consentry]`; if the tool's `requiredArgs` includes that field, the call is blocked

Consent answers: `minimize` (recommended when available), `allow_once`, `allow_always` (creates a 30-day grant scoped to *category × recipient × purpose*), `deny`. Timeouts deny.

## The LLM boundary

With Claude enabled:
1. The user prompt goes through `inspectLLMText()` under the `llm` tier: health conditions may be shared for reasoning, everything else becomes `{{vault:key}}`, and government IDs, credentials and mental-health data are withheld.
2. The system prompt lists the user's profile *as permitted by policy*: real values where allowed, tokens otherwise, and a note when an item will always be withheld.
3. Claude calls tools with tokens. The firewall resolves each token per recipient.
4. **Tool results are tokenized again** before they go back to Claude, so a partner echoing your name doesn't leak it to the model.
5. The final answer is de-tokenized locally for display.

The loop uses the Anthropic SDK (`client.beta.messages.create`) with server-side refusal fallbacks enabled, and appends full `response.content` blocks each turn.

## Ingress quarantine

Tool output is untrusted. `scanPayload()` walks every string ≥ 24 characters and scores 12 signals (instruction override, addressing the AI, role spoofing, exfil requests, tool steering, secrecy requests, fake authority, markdown-image exfil, templated URLs, hidden Unicode, HTML comments, base64 blobs) with a noisy-OR combination. At ≥ 0.4 it strips comments, images, hidden characters and suspicious sentences. Separately, any `{{vault:…}}` token inside tool output is neutralized ("token smuggling"). Medium or high severity **taints the run**: for the rest of it, data of sensitivity ≥ 4 is denied to everyone but the LLM.

## Ledger

```
entry.hash = SHA-256( prevHash | canonicalJSON(entry without hash) )
```

- Canonical JSON (sorted keys) makes hashes identical across Node and browsers.
- Appends are serialized through a promise queue so concurrent tool calls can't fork the chain.
- Egress entries store `fields: [{ item, category, action, after(masked) }]` and `payloadDigest = SHA-256(canonical sanitized args)`. An auditor can prove what was sent without the ledger holding it.
- `verify()` recomputes every hash and returns the first broken sequence number.

## Persistence

| Mode | Store | Encryption |
|---|---|---|
| Gateway | SQLite (`node:sqlite`, WAL): `kv` table for state, `ledger` table | Vault, chat and API key in one AES-256-GCM blob; key in `.consentry/master.key` (`0600`) |
| Local-first | `localStorage` | Same blob, encrypted with a non-extractable `CryptoKey` kept in IndexedDB |

## Events

The runtime emits a typed event stream (`run.start`, `agent.step`, `llm.egress`, `tool.call`, `firewall.egress`, `firewall.ingress`, `tool.result`, `consent.request`, `consent.resolved`, `agent.message`, `run.end`, `ledger.append`, `state.changed`). The gateway relays it over SSE; the local client subscribes in-process. The dashboard's flow map, feed, consent modal and receipts are all projections of this stream.

## Threat model (summary)

| Threat | Mitigation |
|---|---|
| Agent over-shares to a tool | Field-level policy + minimizers |
| Indirect prompt injection via tool output | Ingress quarantine + run taint + egress enforcement |
| Exfiltration to attacker host | Default-deny egress for unverified domains |
| Zero-click exfil via rendered images | Scanner strips them; renderer never loads remote images |
| Over-collection by partners | Per-field decisions; required-field blocking |
| Model provider sees PII | Tokenization of prompts and tool results |
| Audit log tampering | Hash chain; external anchoring (roadmap) |
| Data at rest theft | AES-256-GCM vault & chat |
