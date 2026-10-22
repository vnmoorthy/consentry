# Idea log: how we picked Consentry

**Event:** National Renaissance Hackathon at super{set}, San Francisco.
**Tracks:** (1) Hacking with Public Data APIs (MCP server, CLI or UI) · (2) Personal agents & data privacy, with user consent.
**Theme:** "Renaissance engineers": interdisciplinary builders who combine technical, user, business and systems thinking.
**Context:** super{set} built and backs data and privacy companies (e.g. Ketch for consent and data control, Habu for data clean rooms), so the judges know this space deeply.

## Candidates

| # | Idea | Track fit | Wow | Feasible in a day | Business | Verdict |
|---|---|---|---|---|---|---|
| 1 | **Consentry**: a consent firewall for AI agents (field-level minimization, in-flow consent, LLM tokenization, injection quarantine, hash-chained receipts), with public-data APIs as the agent's tools and an MCP server | **Both tracks** | ★★★★★ live flow map, red-team "compromised agent" moment | ★★★★ | ★★★★★ "consent management for the agent era" | **Picked** |
| 2 | Data-broker removal agent using state data-broker registries to auto-draft deletion requests | Both | ★★★ | ★★★★ | ★★★ (crowded: DeleteMe, Incogni, CA DROP) | Runner-up |
| 3 | "What can be inferred about you" mirror from public datasets | 1 | ★★★★ | ★★★ | ★★ | Rejected (doxxing risk) |
| 4 | Civic MCP: one MCP server over 30 government APIs with a natural-language UI | 1 | ★★ | ★★★★★ | ★★ | Folded into Consentry's toolset |
| 5 | Privacy-policy diff tracker with agent alerts | 2 | ★★ | ★★★★ | ★★★ | Rejected (common) |
| 6 | Personal data clean room: answer third-party questions without revealing raw data | 2 | ★★★★ | ★★ | ★★★★ | Rejected (too big for a day) |

## Why Consentry wins

- **It hits both tracks in one product:** real public data (NWS, USGS, NHTSA, openFDA, OpenFEMA, Open-Meteo, Wikipedia) used *by* a personal agent *under* a consent layer, delivered as UI + MCP server + HTTP gateway.
- **A demo moment judges remember:** an injected review tells the agent to exfiltrate the SSN, a simulated compromised agent tries, and the firewall blocks every byte, live on the flow map.
- **Renaissance-engineer breadth:** systems (choke-point architecture, isomorphic core), security (threat model, ledger), UX (consent with exact vs. minimized previews, receipts) and business (consent management for agents).
- **Honest and safe:** a fictional persona, partners labeled as simulated, no scraping of real people.
