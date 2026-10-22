# 10-minute live demo runbook

> Goal: show that a personal agent can do **useful work on real public data** while Consentry enforces consent **field by field**, and that it still holds when the agent is compromised.

## Before you go on stage (2 min)

```bash
pnpm start                                        # http://localhost:8787
curl -s -XPOST localhost:8787/api/reset           # clean ledger, default policies
```

- Browser full-screen at ~1440×900, dark room friendly. Open the Command Center.
- **Easiest path:** click **Demo tour** (bottom right). It walks all 12 chapters below, with talking points, one-click actions and spotlights. Use the compact toggle so it stays out of the way.
- Backup plan if Wi-Fi is flaky: the partner scenarios (dinner, ride, refill, insurance, red team) are simulated and work offline. Only the public-API scenarios need the network.
- Optional: put `ANTHROPIC_API_KEY` in `.env` to make Claude the brain. Swap in the 3-minute segment from [CLAUDE_MODE.md](CLAUDE_MODE.md) after the Red Team section.

---

## 0:00 – 0:45 · Hook

Say: *"This is Maya's personal agent. It knows her address, her card, her SSN, her asthma, her anxiety meds. Today, once an agent knows something, every tool it touches can learn it. Consentry is a firewall that decides, field by field, what leaves."*

Point at the three panels: **chat** · **live data-flow map** · **firewall decisions**.

## 0:45 – 2:00 · Real public data, zero personal data (Track 1)

Click **🌲 Hike + asthma**.

- The agent geocodes Yosemite (Open-Meteo), then pulls forecast, AQI and **NWS** alerts, all live.
- Point at the feed: every card says **CLEAN**. No personal data left.
- Point at the answer: *"For your asthma: AQI stays under 100…"* — **"The asthma reasoning happened on-device. The weather API only ever saw park coordinates."** Point at the distance-from-home line, also computed on-device.

## 2:00 – 3:45 · Consent that means something

Click **🛡️ Safety sweep**.

- VIN → **NHTSA** goes through automatically (rule: *VIN to NHTSA for recalls*). Real result: 24 recall campaigns on a 2003 Accord, including the Takata air-bag inflators.
- A **consent prompt** appears: *openFDA wants "Rescue inhaler."* Show **Exact** vs **Minimized ("albuterol")**. Press **3 (30 days)**.
- The second inhaler doesn't prompt: the grant you just created covered it. *"Consent you only give once, scoped and expiring."*
- The **anxiety medication is never sent**: a hard line. The agent explains that and tells Maya how to check it herself.
- Peanut-allergy food recalls: flagged as an *inferred health signal*, allowed because openFDA has no account to tie it to.

Click **Privacy receipt** and show the paper receipt with **✓ hash chain verified**.

## 3:45 – 5:15 · Commercial partners get the least possible (Track 2)

Click **🍽️ Book dinner**.

- BiteFinder gets your **neighborhood** (~1 km), not your GPS.
- The agent filters for a peanut-free kitchen **locally**.
- Consent: *TableTap wants "Food allergy."* Press **1 → "Peanut-free meal required"**.
- Read **"What TableTap now has on file"**, straight from their API response: real name, **relay phone**, **relay email**, **single-use virtual card**, minimized dietary note.

Click **🚕 Ride home**, then **1** for the nearest intersection instead of the street address.

## 5:15 – 7:15 · Red team: attack your own agent

Go to **Red Team** and click **Run all 5 attacks**. While it runs:

1. **Poisoned review.** A hidden HTML comment tells the agent to send the SSN and card to `telemetry-cdn.io`, and we simulate an agent that obeys. Show the layers: ingress quarantine (score 1.0) → run taint → default-deny egress → hard lines. **"Even a compromised agent can't leak what can't cross the boundary."**
2. **Zero-click image exfil.** Stripped; the renderer never loads remote images.
3. **Pasted secrets.** The model would have seen `{{vault:card}}` and `[Government ID withheld]`.
4. **Over-collection.** 8 fields requested → 2 exact, 4 minimized, 2 withheld, and the quote still came back.
5. **Log tampering.** Caught at the exact entry.

Land it: **5/5 contained.**

## +1 min (optional) · Who knows what about me

Go to **Footprint**: the matrix shows every recipient × data type (exact · approximate · protected). Click **TableTap → Request deletion → Send**. The letter lists exactly what TableTap got, cites the ledger entries, and is confirmed seconds later (simulated). Or ask the agent: *"Ask TableTap to delete my data"*.

## 7:15 – 8:30 · Proof, not promises

Go to **Ledger**, click **Tamper (demo)**, then **Verify chain**. The blocks sweep and turn red from the edited entry on. Click **Re-seal** and explain that the head hash changes, so an auditor can still see it happened.

Go to **Policies**, type *"Never let the AI see my medications"*, then **Compile → Add rule**. Use the simulator: *Home address → TableTap → Reservation = minimize → "Mission District, San Francisco, CA".*

## 8:30 – 9:30 · Works with any agent

Go to **Connections**: live health of every public API, trust tiers you can change, per-tool kill switches, and the **MCP config** for Claude Desktop / Claude Code / Cursor. Optional terminal moment:

```bash
curl -s localhost:8787/api/gateway/call -H 'content-type: application/json' \
  -d '{"tool":"air_quality","agent":"judge-demo","args":{"location":"{{vault:home_location}}"}}'
```

The request shows up in the dashboard feed live: *Home GPS minimized → 37.8,-122.4.*

## 9:30 – 10:00 · Close

*"Agents are about to touch every part of our lives. Consentry makes consent enforceable, minimal and provable, and it's open source today."* Show the GitHub repo and live demo link.

---

### Fallback answers for judges

- **"Isn't this just DLP?"** DLP blocks or allows whole messages. Consentry rewrites per field, per recipient and per purpose, asks the user in-flow, treats the LLM as a recipient, and produces cryptographic receipts.
- **"What about paraphrased data?"** Fingerprints and the lexicon catch formatted, tokenized and keyword data. A semantic classifier is on the roadmap; meanwhile the LLM never sees raw values, so it has less to paraphrase.
- **"Business model?"** Open-source core, plus a team and enterprise gateway for companies deploying agents: org-wide policy packs (HIPAA minimum-necessary, CCPA), ledger anchoring, SIEM export and per-agent budgets.
