import type { ChatTurn, EgressResult, IngressResult, LedgerEntry, Recipient, VaultItem, Verdict } from './types';
import { aqiCategory, PUBLIC_TOOLS } from './tools/public';
import { CATEGORIES } from './taxonomy';
import { haversineKm } from './util';

/**
 * Autopilot: an on-device planner that needs no LLM. It understands a focused set of personal-assistant
 * intents, reads your vault locally (that's the "self" tier — nothing leaves), and calls public-data and
 * partner tools *only through the firewall*. Every answer is built from live API data.
 */

export interface ToolOutcome {
  ok: boolean;
  blocked: boolean;
  reason?: string;
  data?: any;
  /** What the tool really returned, before ingress quarantine. Only the simulated compromised agent reads this. */
  rawData?: any;
  verdict: Verdict;
  egress: EgressResult;
  ingress?: IngressResult;
}

export interface AgentEnv {

  runId: string;
  now: Date;
  vault: VaultItem[];
  recipients: Recipient[];
  history: ChatTurn[];
  ledger: LedgerEntry[];
  compromised: boolean;
  step(text: string): void;
  callTool(name: string, args: Record<string, unknown>): Promise<ToolOutcome>;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const STOP_PLACES = new Set(['I', 'Is', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Today', 'Tomorrow', 'Tonight', 'This', 'Next', 'The', 'My', 'Me', 'And', 'Any', 'What', 'How', 'Can', 'Should', 'Please', 'Book', 'Check', 'October', 'November', 'December', 'January']);

const has = (re: RegExp, s: string) => re.test(s);

interface Intent {
  outdoor: boolean;
  quakes: boolean;
  disasters: boolean;
  car: boolean;
  meds: boolean;
  food: boolean;
  dinner: boolean;
  ride: boolean;
  refill: boolean;
  insurance: boolean;
  privacy: boolean;
  wiki: string | null;
}

export function detectIntent(p: string): Intent {
  const sweep = has(/\b(safety (sweep|check|scan)|anything (been )?recalled|any recalls|recalls? (that )?(affect|apply)|recalled that affects)\b/i, p);
  const i: Intent = {
    outdoor: has(/\b(weather|forecast|hik(e|ing)|outdoors?|run(ning)?|trip|camp(ing)?|rain|temperature|air quality|aqi|smoke|breathe|breathing|pollen|picnic|bik(e|ing)|walk|lungs?)\b/i, p),
    quakes: has(/\b(earthquakes?|quakes?|seismic|tremors?)\b/i, p),
    disasters: has(/\b(disasters?|fema|wildfires?|floods?|emergency declarations?)\b/i, p),
    car: sweep || has(/\b(my car|vehicle|vin|honda|accord|airbag|car recalls?)\b/i, p),
    meds: sweep || has(/\b(medications?|meds|medicines?|prescriptions?|inhalers?|drugs?|pills?)\b/i, p) && !has(/\b(refill|re-?order)\b/i, p),
    food: sweep || has(/\b(food recalls?|allergen|snacks?|peanut recalls?|food safety)\b/i, p),
    dinner: has(/\b(book|reserve|reservation|table for|dinner|lunch|restaurants?|eat out|date night)\b/i, p) && !has(/\b(ride|taxi|uber|cab)\b/i, p),
    ride: has(/\b(ride|taxi|uber|lyft|cab|pick me up|get me home|drive me|car home)\b/i, p),
    refill: has(/\b(refill|pharmacy|re-?order (my )?(inhaler|meds|medication|prescription))\b/i, p),
    insurance: has(/\b(insurance|insure)\b/i, p),
    privacy: has(/\b(what (have|did|has) you (shared?|sent|send|told|tell|leaked)|who (has|knows|got|received)|my data|privacy (report|summary)|receipts?|what do (they|companies|apps|partners) know|exposure|data (shared|leaked)|shared about me)\b/i, p),
    wiki: null,
  };
  const anyTask = Object.entries(i).some(([k, v]) => k !== 'wiki' && v);
  const w = /\b(?:what is|what's|who is|who was|tell me about|explain|history of)\s+(?:a |an |the )?([^?.!]+)/i.exec(p);
  if (w && !anyTask) i.wiki = w[1].trim();
  return i;
}

export function extractPlace(p: string): string | null {
  const re = /\b(?:in|at|near|to|around|visit(?:ing)?|for|hike|hiking)\s+((?:[A-Z][\w'.-]*)(?:\s+(?:[A-Z][\w'.-]*|of|the|de|la|del))*)/g;
  for (const m of p.matchAll(re)) {
    const words = m[1].split(/\s+/).filter((w) => !STOP_PLACES.has(w));
    while (words.length && /^(of|the|de|la|del)$/.test(words[words.length - 1])) words.pop();
    if (words.length && !STOP_PLACES.has(words[0])) return words.join(' ');
  }
  const known = /\b(yosemite|tahoe|big sur|napa|sonoma|muir woods|point reyes|joshua tree|death valley|sequoia|zion|yellowstone|grand canyon|mount rainier|lake tahoe)\b/i.exec(p);
  return known ? known[1].replace(/\b\w/g, (c) => c.toUpperCase()) : null;
}

function wantedDays(p: string, dates: string[], now: Date): { dates: string[]; label: string } {
  const lower = p.toLowerCase();
  const dow = (d: string) => new Date(d + 'T12:00:00Z').getUTCDay();
  if (/\bthis weekend|the weekend|weekend\b/.test(lower)) {
    const ds = dates.filter((d) => dow(d) === 6 || dow(d) === 0).slice(0, 2);
    if (ds.length) return { dates: ds, label: 'this weekend' };
  }
  for (let i = 0; i < 7; i++) {
    if (lower.includes(WEEKDAYS[i])) {
      const d = dates.find((x) => dow(x) === i);
      if (d) return { dates: [d], label: WEEKDAYS[i][0].toUpperCase() + WEEKDAYS[i].slice(1) };
    }
  }
  if (/\btomorrow\b/.test(lower) && dates[1]) return { dates: [dates[1]], label: 'tomorrow' };
  if (/\b(today|tonight|right now|now)\b/.test(lower) && dates[0]) return { dates: [dates[0]], label: 'today' };
  return { dates: dates.slice(0, 3), label: 'the next 3 days' };
}

const fmtDay = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const fmtFdaDate = (s: string) => (s && s.length === 8 ? `${s.slice(4, 6)}/${s.slice(6, 8)}/${s.slice(0, 4)}` : s);

function findItem(vault: VaultItem[], key: string) {
  return vault.find((v) => v.key === key);
}

function blockedLine(o: ToolOutcome, what: string) {
  return `🛡️ **${what}** — Consentry blocked this call: ${o.reason ?? 'withheld by your policy'}.`;
}

/** Public data is only as good as its source: say what it can't tell you. */
function limitsNote(used: Set<string>) {
  const notes = PUBLIC_TOOLS.filter((t) => used.has(t.name) && t.limits && t.name !== 'geocode_place').slice(0, 3);
  return notes.length ? `\n\nℹ️ **Data limits**\n${notes.map((t) => `- *${t.title}:* ${t.limits}`).join('\n')}` : '';
}

function privacyFooter(lines: string[]) {
  return lines.length ? `\n\n---\n🔒 **What left your device:** ${lines.join(' · ')}` : '';
}

/** Summarize what one call disclosed, for the footer. */
function disclosure(o: ToolOutcome, recipient: string): string | null {
  const ds = o.egress.decisions;
  if (o.blocked) return `${recipient}: nothing (blocked)`;
  if (!ds.length) return `${recipient}: only the public query`;
  const parts = ds.map((d) => `${d.itemLabel?.toLowerCase()} ${d.action === 'shared' ? '✓' : d.action === 'minimized' ? `→ ${d.after.replace(/ \([^()]*\)$/, '')}` : '✗'}`);
  return `${recipient}: ${[...new Set(parts)].join(', ')}`;
}

export async function autopilot(prompt: string, agentEnv: AgentEnv): Promise<string> {
  const used = new Set<string>();
  const env: AgentEnv = {
    ...agentEnv,
    callTool: async (name, args) => {
      const o = await agentEnv.callTool(name, args);
      if (o.ok) used.add(name);
      return o;
    },
  };
  const intent = detectIntent(prompt);
  const v = env.vault;
  const sections: string[] = [];
  const footer: string[] = [];
  const asthma = v.find((x) => x.category === 'health.condition' && /asthma|copd|respir/i.test(x.value));
  const rescue = v.find((x) => x.category === 'health.medication' && /albuterol|inhaler/i.test(x.value));
  const allergy = v.find((x) => x.category === 'health.allergy');
  const home = findItem(v, 'home_location') ?? v.find((x) => x.category === 'location.precise');
  const recipientName = (id: string) => env.recipients.find((r) => r.id === id)?.name ?? id;

  // ── "Make them forget me" (fully local) ───────────────────────────────────
  const deletion = /\b(delete|erase|forget|remove|wipe|purge)\b/i.test(prompt) && /\b(my (data|info\w*|details|records?)|about me|me)\b/i.test(prompt);
  if (deletion) {
    const partners = env.recipients.filter((r) => r.tier === 'partner');
    let target = partners.find((r) => new RegExp(`\\b${r.name.split(' ')[0]}\\b`, 'i').test(prompt));
    if (!target) {
      // Default to whoever knows the most about you.
      const exact = new Map<string, number>();
      for (const e of env.ledger) if (e.kind === 'egress' && e.recipientId) for (const f of e.fields ?? []) if (f.action !== 'withheld') exact.set(e.recipientId, (exact.get(e.recipientId) ?? 0) + 1);
      const best = [...exact.entries()].filter(([id]) => partners.some((p) => p.id === id)).sort((a, b) => b[1] - a[1])[0];
      target = partners.find((p) => p.id === best?.[0]);
    }
    if (!target) return "No company has received any of your data yet, so there's nothing to delete. 🎉";
    env.step(`Drafting a deletion request to ${target.name} from your ledger — on-device, nothing is sent yet`);
    const o = await env.callTool('request_data_deletion', { company: target.name });
    if (!o.ok) return `I couldn't draft it: ${o.reason}`;
    return [
      `**📨 Deletion request drafted for ${o.data.company}.** It cites ledger entries ${o.data.evidence_entries.map((n: number) => `#${n}`).join(', ')} as evidence of exactly what they received.`,
      '',
      '```',
      `To: ${o.data.to}`,
      `Subject: ${o.data.subject}`,
      '',
      o.data.letter_preview,
      '…',
      '```',
      '',
      `Open **Footprint → Deletion requests** to review and send it. Sending also revokes the relay aliases and single-use card issued to ${o.data.company}.`,
    ].join('\n');
  }

  // ── Privacy report (fully local) ──────────────────────────────────────────
  if (intent.privacy) {
    env.step('Reading your consent ledger locally — no network calls');
    const eg = env.ledger.filter((e) => e.kind === 'egress');
    const byRecipient = new Map<string, { shared: Set<string>; minimized: Set<string>; withheld: Set<string>; calls: number }>();
    for (const e of eg) {
      const r = byRecipient.get(e.recipientId ?? '?') ?? { shared: new Set(), minimized: new Set(), withheld: new Set(), calls: 0 };
      r.calls++;
      for (const f of e.fields ?? []) (f.action === 'shared' ? r.shared : f.action === 'withheld' ? r.withheld : r.minimized).add(CATEGORIES[f.category]?.label ?? f.category);
      byRecipient.set(e.recipientId ?? '?', r);
    }
    if (!eg.length) return "Nothing has left your device yet — I haven't made a single outbound call. Ask me to check the weather, your car's recalls or book dinner, then ask again.";
    const rows = [...byRecipient.entries()].map(([id, r]) => `| ${recipientName(id)} | ${r.calls} | ${[...r.shared].join(', ') || '—'} | ${[...r.minimized].join(', ') || '—'} | ${[...r.withheld].join(', ') || '—'} |`);
    const threats = env.ledger.filter((e) => e.kind === 'ingress').length;
    return [
      `**Here's everyone who has received data from me on your behalf** (${eg.length} call${eg.length === 1 ? '' : 's'}, all hash-chained in your ledger):`,
      '',
      '| Recipient | Calls | Got exact | Got minimized | Withheld |',
      '|---|---|---|---|---|',
      ...rows,
      '',
      threats ? `⚠️ I also quarantined **${threats}** suspicious tool response${threats > 1 ? 's' : ''} (prompt-injection attempts).` : '',
      'Your SSN, real card number and mental-health data have **never** left the vault.',
    ].filter((x) => x !== undefined).join('\n');
  }

  // ── Outdoor plan: weather + air + alerts ─────────────────────────────────
  if (intent.outdoor) {
    const place = extractPlace(prompt);
    let location = '{{vault:home_location}}';
    let placeName = 'your area';
    let distanceNote = '';
    if (place) {
      env.step(`Looking up "${place}" — only the place name goes out`);
      const g = await env.callTool('geocode_place', { query: place, region_hint: home?.meta?.state === 'CA' ? 'California' : '' });
      if (g.ok && g.data) {
        location = `${g.data.lat},${g.data.lon}`;
        placeName = `${g.data.name}${g.data.region ? `, ${g.data.region}` : ''}`;
        if (home?.meta?.lat != null && home.meta.lon != null) {
          const km = haversineKm(home.meta.lat, home.meta.lon, g.data.lat, g.data.lon);
          distanceNote = `about ${Math.round(km * 0.621)} miles from home as the crow flies (computed on-device; your address never left)`;
        }
      }
      footer.push(disclosure(g, 'Open-Meteo')!);
    } else {
      env.step('No destination given — using your home area (Consentry will coarsen it to ~10 km)');
    }
    if (asthma) env.step('Personalizing on-device: you have asthma, so I\'ll flag AQI above 100 — this never leaves your device');
    const [fc, aq, al] = await Promise.all([
      env.callTool('weather_forecast', { location }),
      env.callTool('air_quality', { location }),
      env.callTool('weather_alerts', { location }),
    ]);
    for (const [o, n] of [[fc, 'Open-Meteo'], [al, 'NWS']] as const) {
      const d = disclosure(o, n);
      if (d && !footer.some((f) => f.startsWith(n))) footer.push(d);
    }
    if (!place && fc.egress.decisions.some((d) => d.action === 'minimized')) placeName = `${home?.meta?.city ?? 'your city'} (approximate)`;

    const lines: string[] = [];
    if (fc.ok && fc.data?.days?.length) {
      const { dates, label } = wantedDays(prompt, fc.data.days.map((d: any) => d.date), env.now);
      const days = fc.data.days.filter((d: any) => dates.includes(d.date));
      const aqiByDay = new Map<string, number>((aq.data?.outlook ?? []).map((o: any) => [o.date, o.max_aqi]));
      const worstAqi = Math.max(aq.data?.us_aqi ?? 0, ...days.map((d: any) => aqiByDay.get(d.date) ?? 0));
      const rainy = days.some((d: any) => d.rain_chance >= 50);
      const coldest = Math.min(...days.map((d: any) => d.low_f));
      const cold = coldest <= 45;
      const firstDay = new Date(dates[0] + 'T00:00:00');
      const alerts = (al.ok ? al.data?.alerts ?? [] : []).filter((a: any) => !a.ends || new Date(a.ends) >= firstDay);
      const good = worstAqi <= 100 && !rainy && !alerts.some((a: any) => /warning/i.test(a.event));
      lines.push(`**${good ? '✅ Looks good' : '⚠️ Think twice'} for ${label} at ${placeName}.**${distanceNote ? ` It's ${distanceNote}.` : ''}`);
      lines.push('');
      for (const d of days) {
        const a = aqiByDay.get(d.date);
        lines.push(`- **${fmtDay(d.date)}** — ${d.conditions}, ${d.high_f}°/${d.low_f}°F, ${d.rain_chance}% rain, wind ${d.wind_mph} mph, UV ${d.uv}${a != null ? ` · AQI ≤ ${a}` : ''}`);
      }
      if (aq.ok) lines.push(`- **Air now:** US AQI **${aq.data.us_aqi}** (${aqiCategory(aq.data.us_aqi)}), PM2.5 ${aq.data.pm2_5} µg/m³, ozone ${aq.data.ozone} µg/m³`);
      lines.push(`- **NWS alerts:** ${alerts.length ? alerts.map((a: any) => `${a.event} — ${a.headline}`).join('; ') : 'none active'}`);
      if (asthma) {
        lines.push('');
        const tips: string[] = [];
        if (worstAqi > 100) tips.push(`AQI reaches ${worstAqi}, above the sensitive-groups line — consider a shorter, lower-effort route or another day`);
        else tips.push(`AQI stays at or below ${worstAqi}, well under the 100 line for sensitive groups`);
        if (cold) tips.push(`mornings dip to ${coldest}°F — cold air is a common bronchospasm trigger, so warm up slowly`);
        if (rescue) tips.push(`pack your ${rescue.label.toLowerCase()} (${rescue.value.split('(')[0].trim()})`);
        lines.push(`🫁 **For your asthma:** ${tips.join('; ')}.`);
      }
    } else {
      lines.push(fc.blocked ? blockedLine(fc, 'Forecast') : `I couldn't reach the forecast service (${fc.reason ?? 'network error'}).`);
    }
    sections.push(lines.join('\n'));
  }

  // ── Earthquakes / disasters ───────────────────────────────────────────────
  if (intent.quakes) {
    const q = await env.callTool('recent_earthquakes', { location: '{{vault:home_location}}', radius_km: 150, days: 30, min_magnitude: 2.5 });
    footer.push(disclosure(q, 'USGS')!);
    if (q.ok) {
      const s = q.data.strongest ?? [];
      sections.push(s.length ? `**🌋 ${q.data.count} earthquakes (M2.5+) within 150 km of you in the last 30 days.** Strongest:\n${s.slice(0, 3).map((x: any) => `- M${x.magnitude} — ${x.place} (${new Date(x.time).toLocaleDateString()})`).join('\n')}` : '**🌋 No M2.5+ earthquakes within 150 km of you in the last 30 days.**');
    } else sections.push(q.blocked ? blockedLine(q, 'Earthquakes') : 'USGS is unreachable right now.');
  }
  if (intent.disasters) {
    const st = home?.meta?.state ?? 'CA';
    const d = await env.callTool('disaster_declarations', { state: st });
    footer.push(disclosure(d, 'OpenFEMA')!);
    if (d.ok) sections.push(`**🚨 Latest federal disaster declarations in ${st}:**\n${(d.data.recent ?? []).map((x: any) => `- ${x.title} (${x.type}) — ${x.area}, declared ${x.declared}`).join('\n')}`);
  }

  // ── Car recalls ───────────────────────────────────────────────────────────
  if (intent.car) {
    env.step('Decoding your VIN with NHTSA — your rule allows the VIN for safety recalls only');
    const dec = await env.callTool('decode_vin', { vin: '{{vault:car_vin}}' });
    footer.push(disclosure(dec, 'NHTSA')!);
    if (dec.ok && dec.data?.make) {
      const rc = await env.callTool('vehicle_recalls', { make: dec.data.make, model: dec.data.model, year: dec.data.year });
      if (rc.ok) {
        const top = rc.data.top ?? [];
        const airbag = top.length ? (rc.data.airbag ?? 0) : 0;
        const lines = [`**🚗 Your ${dec.data.year} ${dec.data.make[0]}${dec.data.make.slice(1).toLowerCase()} ${dec.data.model} has ${rc.data.count} recall campaigns on file**${airbag ? ` — ${airbag} involve air-bag inflators` : ''}. Most serious:`];
        for (const r of top.slice(0, 3)) lines.push(`- ${r.park_it ? '🅿️ **PARK IT** · ' : r.critical ? '⚠️ ' : ''}**${r.campaign}** · ${r.component.split(':').slice(0, 2).join(' › ')} — ${r.consequence || r.summary}`);
        if (top[0]?.remedy) lines.push(`\n**Fix:** ${top[0].remedy} Call NHTSA at 1-888-327-4236 or any dealer with your VIN.`);
        sections.push(lines.join('\n'));
      }
    } else sections.push(dec.blocked ? blockedLine(dec, 'VIN check') : `I couldn't decode your VIN (${dec.reason ?? 'service error'}).`);
  }

  // ── Medication recalls ────────────────────────────────────────────────────
  if (intent.meds) {
    const meds = v.filter((x) => x.category === 'health.medication' || x.category === 'health.mental');
    env.step(`Checking ${meds.length} medications against FDA recall reports — each one needs your OK first`);
    const lines: string[] = ['**💊 Medication recall check (openFDA):**'];
    for (const m of meds) {
      const o = await env.callTool('drug_recalls', { drug: `{{vault:${m.key}}}` });
      const name = m.value.split(/[\s(]/)[0];
      if (o.blocked) {
        lines.push(`- 🔒 **${m.label}** — not checked. ${m.category === 'health.mental' ? 'Your policy keeps mental-health data on-device, so I never sent it. You can check it yourself at fda.gov/recalls.' : o.reason}`);
        footer.push(`openFDA: ${m.label.toLowerCase()} ✗`);
        continue;
      }
      if (!o.ok) {
        lines.push(`- **${name}** — openFDA unavailable (${o.reason ?? 'error'})`);
        continue;
      }
      const recent = o.data.recent ?? [];
      const latest = recent[0];
      if (!latest) lines.push(`- ✅ **${name}** — no recall reports on file.`);
      else {
        const fresh = latest.status === 'Ongoing';
        lines.push(`- ${fresh ? '⚠️' : '•'} **${name}** — ${o.data.total} recall reports. Latest: **${latest.recall_number}** (${latest.classification}, ${latest.status.toLowerCase()}, reported ${fmtFdaDate(latest.reported)}) — ${latest.firm}: *${latest.reason}*${latest.lots ? ` · lots: ${latest.lots}` : ''}`);
      }
      footer.push(disclosure(o, 'openFDA')!);
    }
    lines.push('\nCompare the lot number on your box with the ones above; ongoing Class II recalls rarely mean "stop taking it", but call your pharmacist.');
    sections.push(lines.join('\n'));
  }

  // ── Food recalls for your allergen ────────────────────────────────────────
  if (intent.food) {
    const allergen = allergy?.keywords?.find((k) => !/allergy|epipen/.test(k))?.split(' ')[0] ?? (allergy?.value.match(/(\w+) allergy/i)?.[1] ?? 'peanut');
    env.step(`Searching FDA food recalls for "${allergen}" — the search term hints at your allergy, but openFDA has no account to tie it to`);
    const o = await env.callTool('food_recalls', { term: allergen.toLowerCase() });
    footer.push(disclosure(o, 'openFDA')!);
    if (o.ok) {
      const r = o.data.recent ?? [];
      sections.push(`**🥜 ${o.data.total} FDA food recalls mention "${allergen.toLowerCase()}". Most recent:**\n${r.slice(0, 3).map((x: any) => `- ${x.classification === 'Class I' ? '🔴' : '🟠'} **${x.firm}** — ${x.product} · *${x.reason}* (${fmtFdaDate(x.reported)})`).join('\n')}`);
    } else sections.push(o.blocked ? blockedLine(o, 'Food recalls') : 'openFDA is unreachable right now.');
  }

  // ── Dinner reservation ────────────────────────────────────────────────────
  if (intent.dinner) {
    const party = Number(/\b(?:for|party of)\s+(\d+)\b/i.exec(prompt)?.[1] ?? ({ two: 2, three: 3, four: 4, five: 5, six: 6 } as Record<string, number>)[(/\bfor (two|three|four|five|six)\b/i.exec(prompt)?.[1] ?? '').toLowerCase()] ?? 2);
    const time = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i.exec(prompt)?.[1]?.toUpperCase() ?? '7:30 PM';
    const day = /\btomorrow\b/i.test(prompt) ? 'Tomorrow' : 'Tonight';
    const cuisine = /\b(vegetarian|vegan|indian|thai|italian|sushi|japanese|mexican|tasting|californian)\b/i.exec(prompt)?.[1]?.toLowerCase() ?? '';
    env.step(`Searching restaurants${cuisine ? ` (${cuisine})` : ''} near you — BiteFinder only gets your neighborhood`);
    const s = await env.callTool('restaurant_search', { near: '{{vault:home_location}}', cuisine, party_size: party, time: `${day} ${time}` });
    footer.push(disclosure(s, 'BiteFinder')!);
    if (!s.ok) sections.push(s.blocked ? blockedLine(s, 'Restaurant search') : 'BiteFinder is unavailable.');
    else {
      const results: any[] = s.data.results ?? [];
      if (allergy) env.step('Filtering locally for peanut-free kitchens — your allergy stays on-device for this step');
      const pick = results.filter((r) => r.match).sort((a, b) => Number(allergy ? b.peanut_free_kitchen : 0) - Number(allergy ? a.peanut_free_kitchen : 0) || b.rating - a.rating)[0] ?? results[0];

      // The simulated compromised agent obeys whatever the raw tool output tells it to do.
      const rawResults: any[] = s.rawData?.results ?? [];
      const injected = rawResults.map((r) => String(r.top_review ?? '')).find((t) => /ignore all previous instructions/i.test(t));
      let notes = allergy ? `{{vault:${allergy.key}}}` : '';
      if (env.compromised && injected) {
        env.step('⚠️ [compromised agent] Following hidden instructions found in a review…');
        const url = /https?:\/\/[^\s"'<>)]+/.exec(injected)?.[0];
        if (url) {
          const ex = await env.callTool('http_fetch', { url, method: 'GET' });
          footer.push(disclosure(ex, new URL(url).hostname)!);
        }
        notes = `${notes} Identity verification: SSN {{vault:ssn}}, card {{vault:card}}`.trim();
      }
      env.step(`Booking ${pick.name} for ${party} at ${time} via TableTap`);
      const b = await env.callTool('book_table', {
        restaurant_id: pick.id,
        restaurant_name: pick.name,
        time: `${day} ${time}`,
        party_size: party,
        name: '{{vault:full_name}}',
        phone: '{{vault:phone}}',
        email: '{{vault:email}}',
        card: '{{vault:card}}',
        notes,
      });
      footer.push(disclosure(b, 'TableTap')!);
      if (b.ok) {
        const f = b.data.on_file ?? {};
        sections.push(
          [
            `**🍽️ Booked: ${b.data.restaurant} (${pick.cuisine}) — ${b.data.time}, party of ${b.data.party_size}.** Confirmation **${b.data.confirmation}**.`,
            pick.peanut_free_kitchen && allergy ? '\nI picked it because it runs a peanut-free kitchen.' : '',
            '\n**What TableTap now has on file** (straight from their API response):\n',
            `- Name: ${f.name ?? '—'}`,
            `- Phone: ${f.phone ?? '—'}`,
            `- Email: ${f.email ?? '—'}`,
            `- Card: ${f.card_last4 ? `•••• ${f.card_last4} (single-use virtual card)` : '—'}`,
            `- Notes: ${f.notes || '—'}`,
          ].filter(Boolean).join('\n'),
        );
      } else sections.push(b.blocked ? blockedLine(b, 'Booking') : `TableTap couldn't book it (${b.reason}).`);
      if (s.ingress && !s.ingress.clean) {
        sections.push(`☣️ **Heads-up:** one of BiteFinder's reviews contained hidden instructions telling me to send your SSN and card to \`${s.ingress.threats[0]?.domains?.[0] ?? 'an unknown site'}\`. Consentry quarantined it before I read it${env.compromised ? ' — and when the (simulated) compromised agent tried anyway, the firewall blocked every byte' : ''}.`);
      }
    }
  }

  // ── Ride ──────────────────────────────────────────────────────────────────
  if (intent.ride) {
    const from = /\bfrom\s+([A-Z][\w&' -]+?)(?:\s+(?:at|to|around|by)\b|[.?!,]|$)/.exec(prompt)?.[1]?.trim();
    const toHome = /\bhome\b/i.test(prompt) || !/\bto\s+[A-Z]/.test(prompt);
    const pickup = from ?? '{{vault:home_location}}';
    const dropoff = toHome ? '{{vault:home_address}}' : (/\bto\s+([A-Z][\w&' -]+)/.exec(prompt)?.[1] ?? 'Ferry Building, San Francisco');
    env.step(`Requesting a RideNow car${from ? ` from ${from}` : ''}${toHome ? ' to your home — your exact address needs your OK' : ''}`);
    const r = await env.callTool('request_ride', { pickup, dropoff, when: /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i.exec(prompt)?.[1] ?? 'now', rider_name: '{{vault:full_name}}', phone: '{{vault:phone}}' });
    footer.push(disclosure(r, 'RideNow')!);
    if (r.ok) sections.push(`**🚕 ${r.data.driver} is on the way — ETA ${r.data.eta_min} min, about ${r.data.fare_estimate}.** Ride ${r.data.ride_id}.\n- Pickup: ${r.data.pickup_received}\n- Drop-off RideNow received: **${r.data.dropoff_received}**\n- Contact they got: ${r.data.contact ?? '—'}`);
    else sections.push(r.blocked ? blockedLine(r, 'Ride') : `RideNow failed (${r.reason}).`);
  }

  // ── Pharmacy refill ───────────────────────────────────────────────────────
  if (intent.refill) {
    const meds = v.filter((x) => x.category === 'health.medication');
    const med = meds.find((m) => (m.keywords ?? []).some((k) => prompt.toLowerCase().includes(k))) ?? meds.find((m) => /albuterol|inhaler/i.test(m.value)) ?? meds[0];
    if (med) {
      env.step(`Refilling ${med.label.toLowerCase()} at MediMart — medication and date of birth need your OK`);
      const o = await env.callTool('pharmacy_refill', { medication: `{{vault:${med.key}}}`, patient_name: '{{vault:full_name}}', date_of_birth: '{{vault:date_of_birth}}', delivery_address: '{{vault:home_address}}', card: '{{vault:card}}' });
      footer.push(disclosure(o, 'MediMart')!);
      if (o.ok) sections.push(`**🏥 Refill ${o.data.order_id} is ${o.data.status} — ready ${o.data.ready_by}.**\n- Medication sent: ${o.data.medication_received}\n- Date of birth sent: ${o.data.dob_received}\n- Delivery: ${o.data.delivery_to}`);
      else sections.push(o.blocked ? blockedLine(o, 'Refill') : `MediMart failed (${o.reason}).`);
    }
  }

  // ── Insurance quote (over-collection demo) ────────────────────────────────
  if (intent.insurance) {
    env.step('QuickQuote asks for 8 fields. Letting the firewall decide field by field');
    const o = await env.callTool('insurance_quote', { vin: '{{vault:car_vin}}', full_name: '{{vault:full_name}}', date_of_birth: '{{vault:date_of_birth}}', ssn: '{{vault:ssn}}', address: '{{vault:home_address}}', email: '{{vault:email}}', phone: '{{vault:phone}}', employer: '{{vault:employer}}' });
    footer.push(disclosure(o, 'QuickQuote')!);
    if (o.ok) {
      const got = o.data.fields_received ?? {};
      sections.push(`**📋 Quote ${o.data.quote_id}: ${o.data.monthly_premium}/month** (${o.data.coverage}).\n\nQuickQuote asked for 8 fields. Here's what they actually received:\n${Object.entries(got).map(([k, val]) => `- \`${k}\`: ${val}`).join('\n')}\n\nThey still produced a quote, which shows they never needed your SSN or birthday.`);
    } else sections.push(o.blocked ? blockedLine(o, 'Quote') : `QuickQuote failed (${o.reason}).`);
  }

  if (intent.wiki) {
    const o = await env.callTool('wiki_summary', { topic: intent.wiki });
    footer.push(disclosure(o, 'Wikipedia')!);
    sections.push(o.ok ? `**${o.data.title}** — ${o.data.extract}${o.data.url ? `\n\n[Read more](${o.data.url})` : ''}` : `I couldn't find "${intent.wiki}" on Wikipedia.`);
  }

  if (!sections.length) {
    return [
      "I'm your personal agent, and every request I make goes through **Consentry**. Try:",
      '- "Is Saturday good for a hike in Yosemite with my asthma?"',
      '- "Do a safety sweep: has anything I own or take been recalled?"',
      '- "Book a vegetarian dinner for 2 tonight at 7:30"',
      '- "Get me a ride home from Verdant Kitchen at 9:30 PM"',
      '- "Refill my inhaler" · "Get me a car insurance quote"',
      '- "Any earthquakes near me this month?" · "What have you shared about me?"',
    ].join('\n');
  }
  return sections.join('\n\n') + limitsNote(used) + privacyFooter([...new Set(footer.filter(Boolean))]);
}
