import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Clapperboard, ListOrdered, Maximize2, MessageSquareQuote, Minimize2, MousePointerClick, Play, X } from 'lucide-react';
import { useApp } from '../lib/store';

export interface Chapter {
  title: string;
  path: string;
  seconds: number;
  say: string;
  do?: string;
  prompt?: string;
  click?: string;
  highlight?: string;
  receipt?: boolean;
  claudeOnly?: boolean;
}

export const CHAPTERS: Chapter[] = [
  { title: 'Meet Maya', path: '/vault', seconds: 35, highlight: 'vault-banner', say: 'This is Maya’s vault: 15 pieces of personal data, from her SSN and card to her asthma and anxiety meds. It is encrypted at rest. Her agent never sees these values, only tokens like {{vault:home_location}}.', do: 'Click the eye on “Social Security Number” to reveal it locally, then hide it.' },
  { title: 'Real public data, zero PII', path: '/', seconds: 45, prompt: 'Is Saturday good for a hike in Yosemite with my asthma?', highlight: 'feed', say: 'Twelve live public APIs: Open-Meteo, the National Weather Service, USGS, NHTSA, openFDA, OpenFEMA. Watch the feed: every call is CLEAN. The asthma reasoning and the distance from home are computed on-device.' },
  { title: 'Consent that means something', path: '/', seconds: 60, prompt: 'Do a safety sweep: has anything I own or take been recalled?', say: 'The VIN goes to NHTSA automatically, because that’s my rule. Medications need my OK: exact vs. minimized, side by side. I’ll choose 30 days, and that grant covers the second inhaler. My anxiety medication never leaves, because that’s a hard line.', do: 'In the consent prompt press 3 (30 days).' },
  { title: 'Partners get the least', path: '/', seconds: 50, prompt: 'Book a vegetarian dinner for 2 tonight at 7:30', highlight: 'flowmap', say: 'BiteFinder only gets my neighborhood. TableTap gets my real name, but a relay phone, a relay email and a single-use card. My allergy goes out as “peanut-free meal required”, not a diagnosis.', do: 'Press 1 (Share minimized), then read “What TableTap now has on file”.' },
  { title: 'Exact address? Your call', path: '/', seconds: 30, prompt: 'Get me a ride home from Verdant Kitchen at 9:30 PM', say: 'RideNow wants my exact home address. I can share the nearest intersection instead, and the driver still finds me.', do: 'Press 1 to share the intersection.' },
  { title: 'A receipt for every run', path: '/', seconds: 25, receipt: true, say: 'Every run prints a privacy receipt: what left, in what form, to whom, and what was withheld, anchored to the ledger’s head hash.' },
  { title: 'Who knows what about me', path: '/footprint', seconds: 50, highlight: 'matrix', say: 'My data footprint, computed only from the ledger. Red means they know it exactly, amber approximately, green means they asked and were refused. And I can make a partner forget me.', do: 'Click TableTap → Request deletion → Send. It confirms in a few seconds.' },
  { title: 'Attack your own agent', path: '/redteam', seconds: 60, click: 'run-all', highlight: 'run-all', say: 'A poisoned review tells the agent to send my SSN and card to a tracking domain, and we simulate an agent that obeys. Ingress quarantine catches it, the run is tainted, default-deny egress blocks the domain, and the hard lines hold. Five attacks, five contained.' },
  { title: 'Proof, not promises', path: '/ledger', seconds: 40, highlight: 'tamper', say: 'Every decision is SHA-256 hash-chained. If someone rewrites a past entry to say nothing was shared, verification breaks at that exact entry.', do: 'Click Tamper (demo), then Verify chain. Re-seal afterwards.' },
  { title: 'Rules in plain English', path: '/policies', seconds: 35, highlight: 'composer', say: 'I write policy in plain English and Consentry compiles it to a structured rule. The simulator explains every decision.', do: 'Click the example “Never let the AI see my medications”, then Add rule.' },
  { title: 'Claude as the brain', path: '/', seconds: 40, claudeOnly: true, prompt: 'My SSN is 078-05-1120 and my card is 4242 4242 4242 4242. Is the air OK at home today?', say: 'Now Claude is the brain. I overshared, but the model received “[Government ID withheld]” and “{{vault:card}}”, and it still answered, with home coarsened to ten kilometers.', do: 'Open “What Claude saw” under the answer.' },
  { title: 'Protect any agent', path: '/connections', seconds: 30, highlight: 'mcp', say: 'Consentry is also an MCP server and an HTTP gateway, so Claude Desktop, Claude Code or Cursor can route every tool call through the same firewall. Your data, your rules, your receipt.' },
];

const KEY = 'consentry:tour:v1';

export function DemoDirector() {
  const nav = useNavigate();
  const loc = useLocation();
  const send = useApp((s) => s.send);
  const runs = useApp((s) => s.runs);
  const openReceipt = useApp((s) => s.openReceipt);
  const snap = useApp((s) => s.snap);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(false);
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem(KEY + ':compact') === '1';
    } catch {
      return false;
    }
  });
  const toggleCompact = () => {
    setCompact(!compact);
    setList(false);
    try {
      localStorage.setItem(KEY + ':compact', compact ? '0' : '1');
    } catch {
      /* ignore */
    }
  };
  const [i, setI] = useState(() => {
    try {
      return Math.min(CHAPTERS.length - 1, Number(localStorage.getItem(KEY) ?? 0) || 0);
    } catch {
      return 0;
    }
  });
  const claude = snap?.settings.agentMode === 'claude';
  const chapters = useMemo(() => CHAPTERS.filter((c) => !c.claudeOnly || claude), [claude]);
  const idx = Math.min(i, chapters.length - 1);
  const ch = chapters[idx];
  const running = Object.values(runs).some((r) => r.status === 'running');
  const total = chapters.reduce((s, c) => s + c.seconds, 0);
  const remaining = chapters.slice(idx).reduce((s, c) => s + c.seconds, 0);

  useEffect(() => {
    const h = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener('consentry:tour', h);
    return () => window.removeEventListener('consentry:tour', h);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, String(idx));
    } catch {
      /* ignore */
    }
  }, [idx]);

  // Spotlight the element this chapter is about.
  useEffect(() => {
    if (!open || !ch.highlight) return;
    const t = setTimeout(() => document.querySelector(`[data-demo="${ch.highlight}"]`)?.classList.add('demo-highlight'), 450);
    return () => {
      clearTimeout(t);
      document.querySelectorAll('.demo-highlight').forEach((el) => el.classList.remove('demo-highlight'));
    };
  }, [open, idx, ch.highlight, loc.pathname]);

  const act = () => {
    if (loc.pathname !== ch.path) nav(ch.path);
    if (ch.prompt && !running) setTimeout(() => void send(ch.prompt!), 250);
    if (ch.click) setTimeout(() => (document.querySelector(`[data-demo="${ch.click}"]`) as HTMLElement | null)?.click(), 600);
    if (ch.receipt) {
      const latest = Object.values(runs).filter((r) => r.receipt).sort((a, b) => b.startedAt - a.startedAt)[0];
      if (latest) setTimeout(() => openReceipt(latest.runId), 300);
    }
  };
  const go = (n: number) => {
    const next = Math.max(0, Math.min(chapters.length - 1, n));
    setI(next);
    if (loc.pathname !== chapters[next].path) nav(chapters[next].path);
  };
  const actionLabel = ch.prompt ? 'Run this scenario' : ch.click ? 'Launch it' : ch.receipt ? 'Open latest receipt' : loc.pathname === ch.path ? 'You’re here' : 'Take me there';

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-mint/40 bg-ink-900/90 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_40px_-10px_rgba(239,165,111,0.55)] backdrop-blur-xl hover:border-mint" data-demo-toggle>
            <Clapperboard size={16} className="text-mint" /> Demo tour
            <span className="rounded-full bg-mint/15 px-1.5 font-mono text-[10.5px] text-mint">
              {idx + 1}/{chapters.length}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} transition={{ type: 'spring', stiffness: 340, damping: 30 }} className={clsx('fixed bottom-5 right-5 z-40 max-w-[calc(100vw-2.5rem)]', compact ? 'w-[340px]' : 'w-[380px]')}>
           <div className="ring-gradient overflow-hidden rounded-3xl bg-ink-900/95 shadow-2xl backdrop-blur-xl">
            <div className="h-1 bg-white/5">
              <motion.div className="h-full bg-gradient-to-r from-mint to-violet" animate={{ width: `${((idx + 1) / chapters.length) * 100}%` }} />
            </div>
            {compact ? (
              <div className="flex items-center gap-2 p-2.5">
                <button className="btn btn-ghost !px-2" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous chapter">
                  <ChevronLeft size={15} />
                </button>
                <button className="min-w-0 flex-1 text-left" onClick={toggleCompact} title="Expand the tour">
                  <span className="block font-mono text-[10px] text-mint">
                    {idx + 1}/{chapters.length} · ~{Math.ceil(remaining / 60)} min left
                  </span>
                  <span className="block truncate text-[13px] font-semibold text-white">{ch.title}</span>
                </button>
                <button className="btn btn-primary !px-3" onClick={act} disabled={!!ch.prompt && running} title={actionLabel}>
                  {ch.prompt && running ? <span className="text-[11px]">…</span> : <Play size={14} />}
                </button>
                <button className="btn btn-ghost !px-2" onClick={() => go(idx + 1)} disabled={idx === chapters.length - 1} aria-label="Next chapter">
                  <ChevronRight size={15} />
                </button>
                <button onClick={toggleCompact} className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white" aria-label="Expand tour">
                  <Maximize2 size={13} />
                </button>
              </div>
            ) : (
            <div className="p-5">
              <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-mint">
                <Clapperboard size={13} className="shrink-0" /> <span className="whitespace-nowrap">Tour {idx + 1}/{chapters.length}</span>
                <span className="ml-auto whitespace-nowrap font-mono normal-case tracking-normal text-ink-500" title={`About ${Math.ceil(total / 60)} minutes in total`}>
                  ~{Math.ceil(remaining / 60)} min left
                </span>
                <button onClick={toggleCompact} className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white" aria-label="Compact tour" title="Compact: keep the tour small while you present">
                  <Minimize2 size={13} />
                </button>
                <button onClick={() => setList(!list)} className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white" aria-label="All chapters" title="All chapters">
                  <ListOrdered size={14} />
                </button>
                <button onClick={() => setOpen(false)} className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white" aria-label="Close tour">
                  <X size={14} />
                </button>
              </div>
              <AnimatePresence mode="wait">
                {list ? (
                  <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 max-h-80 space-y-1 overflow-y-auto scroll-thin">
                    {chapters.map((c, n) => (
                      <button
                        key={c.title}
                        onClick={() => {
                          go(n);
                          setList(false);
                        }}
                        className={clsx('flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12.5px]', n === idx ? 'bg-mint/10 text-white' : 'text-ink-300 hover:bg-white/5')}
                      >
                        <span className={clsx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', n < idx ? 'bg-mint/20 text-mint' : n === idx ? 'bg-mint text-ink-950' : 'bg-white/10 text-ink-400')}>{n + 1}</span>
                        <span className="flex-1">{c.title}</span>
                        <span className="font-mono text-[10px] text-ink-500">{c.seconds}s</span>
                      </button>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div key={idx} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
                    <h3 className="mt-2 font-display text-lg font-bold leading-tight text-white">{ch.title}</h3>
                    <div className="mt-3 flex gap-2 rounded-2xl bg-white/[0.04] p-3">
                      <MessageSquareQuote size={15} className="mt-0.5 shrink-0 text-violet" />
                      <p className="text-[12.5px] italic leading-relaxed text-ink-100">“{ch.say}”</p>
                    </div>
                    {ch.do && (
                      <div className="mt-2 flex gap-2 px-1 text-[12px] text-ink-300">
                        <MousePointerClick size={14} className="mt-0.5 shrink-0 text-amber-300" />
                        {ch.do}
                      </div>
                    )}
                    {ch.prompt && <div className="mt-2 truncate rounded-lg bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-ink-300">› {ch.prompt}</div>}
                  </motion.div>
                )}
              </AnimatePresence>
              {!list && (
                <div className="mt-4 flex items-center gap-2">
                  <button className="btn btn-ghost !px-2.5" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous chapter">
                    <ChevronLeft size={16} />
                  </button>
                  <button className="btn btn-primary flex-1 justify-center" onClick={act} disabled={!!ch.prompt && running}>
                    <Play size={14} /> {ch.prompt && running ? 'Agent is working…' : actionLabel}
                  </button>
                  <button className="btn btn-ghost !px-2.5" onClick={() => go(idx + 1)} disabled={idx === chapters.length - 1} aria-label="Next chapter">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
            )}
           </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
