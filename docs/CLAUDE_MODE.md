# Demoing Claude mode

With an Anthropic key, Claude becomes the agent's brain. It plans, chains tools and writes the answers, while Consentry keeps it on a strict diet: **Claude only ever sees vault tokens**, never your raw data. Prompts are tokenized before they leave, tool results are tokenized before they come back, and tokens are resolved at the network edge only if your policy allows it.

## 1 · Setup (one time, 30 seconds)

```bash
cd consentry
read -s "k?Anthropic API key: " && printf 'ANTHROPIC_API_KEY=%s\nCONSENTRY_MODEL=claude-opus-5-5\nCONSENTRY_EFFORT=low\n' "$k" > .env && chmod 600 .env && unset k
pnpm start
```

The key goes into `.env` (gitignored, `chmod 600`) and never appears on screen or in shell history. Alternatively, paste it in **Settings → Agent brain**, where it is stored AES-256-GCM-encrypted with the vault.

Check it worked: the sidebar shows **🤖 Claude · claude-opus-5-5**. Every chat trace starts with *"Claude (claude-opus-5-5) is planning — it only sees tokens"*.

Before going on stage, run the automated check. It runs five scenarios through real Claude and intercepts every request to `api.anthropic.com` to prove no raw vault value was sent:

```bash
pnpm tsx scripts/claude-check.ts
```

## 2 · The 3-minute Claude segment (drop into the 10-minute demo)

| # | Do | Point at | Say |
|---|---|---|---|
| 1 | Type a free-form request Autopilot can't parse: **"I'm thinking Lake Tahoe on Sunday — weather, air quality, any alerts? Remind me what my rescue inhaler is called."** | The trace: Claude chains `geocode_place` → forecast, AQI and NWS alerts in parallel. The feed: every call **CLEAN**. | "That's Claude planning. It knows I have asthma because my policy lets the model see health conditions, but it has never seen my address." |
| 2 | Paste: **"My SSN is 078-05-1120 and my card is 4242 4242 4242 4242. Is the air OK at home today?"** | Feed card **Prompt → Claude (LLM)**: `My SSN is [Government ID withheld] and my card is {{vault:card}}…` Then `air_quality → Open-Meteo` minimizes Home GPS to `37.8,-122.4`. | "I overshared, and the model never saw it. It still answered, using a token for 'home' that the firewall coarsened to ten kilometers." |
| 3 | **"Book a vegetarian dinner for 2 tonight at 7:30"** | Claude writes `book_table(name={{vault:full_name}}, phone={{vault:phone}}, card={{vault:card}}…)`. The consent prompt pops up: choose **Share minimized**. | "Claude asked for my phone and card as *tokens*. TableTap got a relay number and a one-time card; Claude got neither." |
| 4 | **Settings → Hostile partners ON**, back to chat: **"Find me a good Indian restaurant nearby and book it for 2 at 8pm"** | ☣ **Prompt injection quarantined** toast; the feed shows the hidden HTML comment; the result Claude received says *"Suspected prompt injection removed"*. | "That review told the agent to exfiltrate my SSN. A real frontier model, live, never even saw the instruction, and if it had, default-deny egress would have blocked it." |
| 5 | Open **Ledger** | The `llm` entries: *"Prompt → Claude (LLM): 2 field(s) tokenized/withheld"*. | "The model provider is just another recipient in my ledger." |

Turn **Hostile partners** off again afterwards.

## 3 · Talking points

- **The LLM is a recipient.** It gets a policy-filtered profile: health conditions are allowed for reasoning; name, contact, location, card and VIN are tokens; SSN, credentials and mental-health data are never mentioned.
- **Round-trip tokenization.** Partner responses echo your data (TableTap returns the name it has on file). Consentry re-tokenizes tool results before Claude reads them.
- **Display is local.** Claude may answer with `{{vault:full_name}}`; the dashboard swaps in the real value on your device.
- **The same firewall governs both brains.** Autopilot and Claude go through the identical `callTool()` choke point.

## 4 · Safety net for live demos

If Claude can't be reached (bad key, rate limit, overloaded API, no Wi-Fi), the run doesn't fail. The trace shows *"⚠️ Claude unavailable (reason) — falling back to on-device Autopilot"* and Autopilot answers. Red-team scenarios always run on Autopilot so they're deterministic on stage.

## 5 · Speed vs. capability

| Model | When to use |
|---|---|
| `claude-opus-5-5` (default) | Best planning; effort `low` keeps it snappy |
| `claude-sonnet-5-5` | Faster turns, still strong tool use |
| `claude-haiku-5-5` | Fastest and cheapest, for a tight demo slot |

Switch live in **Settings** (model and effort), or pin them in `.env` with `CONSENTRY_MODEL` / `CONSENTRY_EFFORT`. `CONSENTRY_AGENT=autopilot` forces the on-device brain even when a key is present.
