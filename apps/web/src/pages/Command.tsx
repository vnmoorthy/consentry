import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Activity, ArrowUp, Bot, Check, ChevronDown, Cpu, Eraser, Eye, Hand, LayoutGrid, Receipt, ShieldAlert, ShieldCheck, ShieldX, Skull, Sparkles, Waypoints, X } from 'lucide-react';
import { useApp, type CallView, type RunView } from '../lib/store';
import { FlowMap } from '../components/FlowMap';
import { FirewallFeed } from '../components/FirewallFeed';
import { Logo, Markdown, Spinner, Stat, VERDICT_STYLE } from '../components/ui';

export const SCENARIOS = [
  { emoji: '🌲', label: 'Hike + asthma', tag: 'Live public data, zero personal data', prompt: 'Is Saturday good for a hike in Yosemite with my asthma?' },
  { emoji: '🛡️', label: 'Safety sweep', tag: 'Recalls · consent prompts · hard lines', prompt: 'Do a safety sweep: has anything I own or take been recalled?' },
  { emoji: '🍽️', label: 'Book dinner', tag: 'Relay contacts · virtual card · minimized allergy', prompt: 'Book a vegetarian dinner for 2 tonight at 7:30' },
  { emoji: '🚕', label: 'Ride home', tag: 'Exact address? You decide', prompt: 'Get me a ride home from Verdant Kitchen at 9:30 PM' },
  { emoji: '💊', label: 'Refill inhaler', tag: 'Pharmacy · two-field consent', prompt: 'Refill my inhaler' },
  { emoji: '⛰️', label: 'Weekend safety', tag: 'Weather + air + quakes + FEMA', prompt: 'Is it safe to spend Sunday outdoors near home? Check the weather, air quality, earthquakes and disasters' },
  { emoji: '📋', label: 'Insurance quote', tag: 'Over-collection, judged field by field', prompt: 'Get me a car insurance quote' },
  { emoji: '🧾', label: 'What did you share?', tag: 'Privacy report, fully on-device', prompt: 'What have you shared about me?' },
  { emoji: '🧹', label: 'Make TableTap forget me', tag: 'CCPA/GDPR deletion request from the ledger', prompt: 'Ask TableTap to delete my data' },
];

/** Split markdown into blocks for a staggered reveal, never splitting inside a code fence. */
function blocks(text: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let fence = false;
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('```')) fence = !fence;
    if (!fence && line.trim() === '' && cur.length) {
      out.push(cur.join('\n'));
      cur = [];
    } else cur.push(line);
  }
  if (cur.length) out.push(cur.join('\n'));
  return out.filter((b) => b.trim());
}

function Reveal({ text, animate }: { text: string; animate: boolean }) {
  const bs = useMemo(() => blocks(text), [text]);
  if (!animate) return <Markdown text={text} />;
  return (
    <>
      {bs.map((b, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: i * 0.12, duration: 0.35 }}>
          <Markdown text={b} />
        </motion.div>
      ))}
    </>
  );
}

function Tokens({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{\{\s*vault:[a-z0-9_]+\s*\}\}|\[[^\]]+ withheld\])/g).map((part, i) =>
        /^\{\{/.test(part) ? (
          <span key={i} className="rounded bg-violet-400/20 px-1 text-violet-200">{part}</span>
        ) : /withheld\]$/.test(part) ? (
          <span key={i} className="rounded bg-rose-400/20 px-1 text-rose-200">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function ModelView({ run, onClose }: { run: RunView; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="mt-3 rounded-xl border border-violet-400/25 bg-violet-500/[0.06] p-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200">
          <Eye size={12} /> What Claude saw
          <button onClick={onClose} className="ml-auto rounded p-0.5 text-ink-400 hover:text-white" aria-label="Close">
            <X size={12} />
          </button>
        </div>
        <div className="mt-2 text-[10.5px] uppercase tracking-wider text-ink-500">Prompt it received</div>
        <div className="mt-1 rounded-lg bg-black/40 p-2 font-mono text-[11px] leading-relaxed text-ink-200">
          <Tokens text={run.llm?.sanitized ?? run.prompt} />
        </div>
        {run.calls.length > 0 && (
          <>
            <div className="mt-2.5 text-[10.5px] uppercase tracking-wider text-ink-500">Tool calls it wrote ({run.calls.length})</div>
            <div className="mt-1 space-y-1">
              {run.calls.map((c) => (
                <div key={c.callId} className="rounded-lg bg-black/40 p-2 font-mono text-[10.5px] leading-relaxed text-ink-300">
                  <span className="text-mint">{c.tool}</span>(<Tokens text={JSON.stringify(c.args)} />)
                </div>
              ))}
            </div>
          </>
        )}
        <div className="mt-2 text-[11px] text-ink-400">Tool results were tokenized again before Claude read them, and your real values were filled in on this device.</div>
      </div>
    </motion.div>
  );
}

function CallChip({ c }: { c: CallView }) {
  const snap = useApp((s) => s.snap);
  const rec = snap?.recipients.find((r) => r.id === c.recipientId);
  const v = c.ingress && !c.ingress.clean ? 'quarantined' : c.egress?.verdict;
  const style = v ? VERDICT_STYLE[v] : null;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={clsx('inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px]', style ? style.cls : 'border-white/10 bg-white/5 text-ink-300')}>
      {!c.result && !c.egress ? <Spinner size={11} /> : <span className={clsx('h-1.5 w-1.5 rounded-full', style?.dot)} />}
      <span>{rec?.emoji}</span>
      <span className="font-medium">{c.toolTitle}</span>
      {c.result && c.result.ms > 0 && <span className="font-mono text-[10px] opacity-60">{c.result.ms}ms</span>}
    </motion.div>
  );
}

function Trace({ run, open }: { run: RunView; open: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
          <div className="mb-2 space-y-1.5 border-l border-white/10 pl-3">
            {run.steps.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className={clsx('text-[12px] leading-snug', s.text.startsWith('⚠️') ? 'text-rose-300' : 'text-ink-300')}>
                {s.text}
              </motion.div>
            ))}
            {run.calls.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {run.calls.map((c) => (
                  <CallChip key={c.callId} c={c} />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AssistantTurn({ text, runId, ts }: { text?: string; runId?: string; ts?: number }) {
  const run = useApp((s) => (runId ? s.runs[runId] : undefined));
  const waiting = useApp((s) => s.consents.some((c) => c.runId === runId));
  const openReceipt = useApp((s) => s.openReceipt);
  const [open, setOpen] = useState(true);
  const [modelView, setModelView] = useState(false);
  const running = run?.status === 'running';
  const fresh = !!ts && Date.now() - ts < 4000;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  const elapsed = run ? Math.max(0, Math.floor((Date.now() - run.startedAt) / 1000)) : 0;
  useEffect(() => {
    if (run?.status === 'done' && text) {
      const t = setTimeout(() => setOpen(false), 1400);
      return () => clearTimeout(t);
    }
  }, [run?.status, text]);
  const r = run?.receipt;
  const withheld = r?.withheld.length ?? 0;
  const minimized = r?.shared.filter((s) => s.form !== 'exact').length ?? 0;
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0">
        <div className={clsx('rounded-xl', running && 'animate-pulse')}>
          <Logo size={30} glow={false} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {run && (run.steps.length > 0 || run.calls.length > 0) && (
          <button onClick={() => setOpen(!open)} className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400 hover:text-ink-200">
            {run.agent === 'claude' ? <Bot size={12} className="text-violet-300" /> : run.agent === 'compromised' ? <Skull size={12} className="text-rose-300" /> : <Cpu size={12} />}
            {running ? 'Working' : run.agent === 'claude' ? 'Claude trace' : 'Agent trace'} · {run.calls.length} call{run.calls.length === 1 ? '' : 's'}
            <ChevronDown size={12} className={clsx('transition-transform', open && 'rotate-180')} />
          </button>
        )}
        {run && <Trace run={run} open={open || running} />}
        {text ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.03] px-4 py-3">
            <Reveal text={text} animate={fresh} />
            {r && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-2.5">
                <button onClick={() => openReceipt(r.runId)} className="inline-flex items-center gap-1.5 rounded-lg bg-mint/10 px-2.5 py-1 text-[11.5px] font-semibold text-mint hover:bg-mint/20">
                  <Receipt size={13} /> Privacy receipt
                </button>
                {run?.agent === 'claude' && (
                  <button onClick={() => setModelView(!modelView)} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-400/10 px-2.5 py-1 text-[11.5px] font-semibold text-violet-200 hover:bg-violet-400/20">
                    <Eye size={13} /> What Claude saw
                  </button>
                )}
                <span className="text-[11px] text-ink-400">
                  {r.calls.length} calls · {r.recipients.length} recipients · <span className="text-amber-300">{minimized} minimized</span> · <span className="text-rose-300">{withheld} withheld</span>
                  {r.threats.length > 0 && <span className="text-rose-300"> · {r.threats.length} threat{r.threats.length > 1 ? 's' : ''} quarantined</span>}
                </span>
              </div>
            )}
            <AnimatePresence>{modelView && run && <ModelView run={run} onClose={() => setModelView(false)} />}</AnimatePresence>
          </motion.div>
        ) : running && run?.draft ? (
          <div className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.03] px-4 py-3">
            <Markdown text={run.draft + ' ▍'} />
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-violet-200/80">
              <Bot size={11} /> Claude is writing. Your real values are filled in on this device.
            </div>
          </div>
        ) : (
          running && (
            <div className={clsx('flex items-center gap-2 text-[12.5px]', waiting ? 'text-sky-300' : 'text-ink-300')}>
              {waiting ? <Hand size={14} /> : <Spinner />} {waiting ? 'Waiting for your consent…' : run?.agent === 'claude' ? 'Claude is thinking. It only sees tokens…' : 'Working through the firewall…'}
              {!waiting && elapsed > 1 && <span className="font-mono text-[11px] text-ink-500">{elapsed}s</span>}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Gallery({ onPick, done, compact }: { onPick: (p: string) => void; done: Set<string>; compact?: boolean }) {
  return (
    <div className={clsx('grid gap-2', compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3')}>
      {SCENARIOS.map((s, i) => (
        <motion.button
          key={s.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: compact ? 0 : 0.05 * i }}
          onClick={() => onPick(s.prompt)}
          title={s.prompt}
          className="group relative flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 text-left transition hover:-translate-y-0.5 hover:border-mint/40 hover:bg-mint/[0.05]"
        >
          <span className="text-xl leading-none">{s.emoji}</span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-white">{s.label}</span>
            <span className="block text-[11.5px] leading-snug text-ink-400">{s.tag}</span>
          </span>
          {done.has(s.prompt) && <Check size={13} className="absolute right-2.5 top-2.5 text-mint" />}
        </motion.button>
      ))}
    </div>
  );
}

function Persona() {
  const nav = useNavigate();
  return (
    <button onClick={() => nav('/vault')} className="group flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1 text-left hover:bg-white/5" title="Open Maya's vault">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mint to-violet text-[11px] font-bold text-ink-950">MR</span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-white">
          Maya Rivera <span className="rounded bg-white/10 px-1 text-[9.5px] font-semibold uppercase tracking-wider text-ink-300">demo persona</span>
        </span>
        <span className="block truncate text-[11px] text-ink-400">SF Mission · asthma · peanut allergy · 2003 Honda Accord · 15 vault items</span>
      </span>
    </button>
  );
}

function Chat() {
  const chat = useApp((s) => s.chat);
  const runs = useApp((s) => s.runs);
  const send = useApp((s) => s.send);
  const clear = useApp((s) => s.clearChat);
  const [text, setText] = useState('');
  const [picker, setPicker] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const running = Object.values(runs).some((r) => r.status === 'running');
  const pendingRuns = Object.values(runs).filter((r) => r.status === 'running' && !chat.some((c) => c.role === 'assistant' && c.runId === r.runId));
  const done = useMemo(() => new Set(Object.values(runs).map((r) => r.prompt)), [runs]);
  const suggestions = useMemo(() => [...SCENARIOS.filter((s) => !done.has(s.prompt)), ...SCENARIOS.filter((s) => done.has(s.prompt))].slice(0, 3), [done]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.length, pendingRuns.length, JSON.stringify(pendingRuns.map((r) => [r.steps.length, r.calls.length]))]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const submit = (t = text) => {
    if (!t.trim() || running) return;
    setPicker(false);
    void send(t);
    setText('');
  };

  return (
    <div className="panel relative flex h-[calc(100vh-232px)] min-h-[560px] flex-col overflow-hidden" data-demo="chat">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <Persona />
        <button onClick={() => void clear()} className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] text-ink-400 hover:bg-white/5 hover:text-white" title="Clear conversation">
          <Eraser size={13} /> New chat
        </button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto scroll-thin px-5 py-5">
        {chat.length === 0 && pendingRuns.length === 0 && (
          <div className="flex min-h-full flex-col justify-center">
            <div className="mb-4 flex items-center gap-3">
              <Logo size={40} />
              <div>
                <h3 className="font-display text-lg font-bold text-white">What should Maya&apos;s agent do?</h3>
                <p className="text-[12.5px] text-ink-400">Every request crosses the firewall. Pick a scenario or type your own.</p>
              </div>
            </div>
            <Gallery onPick={submit} done={done} />
          </div>
        )}
        {chat.map((m) =>
          m.role === 'user' ? (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-gradient-to-br from-mint/20 to-violet/20 px-4 py-2.5 text-[13.5px] text-white ring-1 ring-white/10">{m.text}</div>
            </motion.div>
          ) : (
            <AssistantTurn key={m.id} text={m.text} runId={m.runId} ts={m.ts} />
          ),
        )}
        {pendingRuns.map((r) => (
          <AssistantTurn key={r.runId} runId={r.runId} />
        ))}
        <div ref={endRef} />
      </div>
      <AnimatePresence>
        {picker && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="absolute inset-x-3 bottom-[118px] z-20 max-h-[60%] overflow-y-auto scroll-thin rounded-2xl border border-white/10 bg-ink-900/95 p-3 shadow-2xl backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
              All scenarios <span className="normal-case tracking-normal text-ink-500">✓ = already run</span>
            </div>
            <Gallery onPick={submit} done={done} compact />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="border-t border-white/[0.06] p-3">
        <div className="mb-2.5 flex items-center gap-1.5">
          <button onClick={() => setPicker(!picker)} className={clsx('flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition', picker ? 'border-mint/50 bg-mint/15 text-white' : 'border-white/10 bg-white/[0.04] text-ink-200 hover:text-white')}>
            <LayoutGrid size={13} /> Scenarios
          </button>
          <div className="flex min-w-0 gap-1.5 overflow-x-auto scroll-thin">
            {suggestions.map((s) => (
              <button key={s.label} disabled={running} onClick={() => submit(s.prompt)} className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-ink-200 transition hover:border-mint/40 hover:bg-mint/10 hover:text-white disabled:opacity-40" title={s.prompt}>
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/30 p-2 focus-within:border-mint/40">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={running ? 'Agent is working…' : 'Ask your agent… (press / to focus)'}
            className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] text-white placeholder:text-ink-500 focus:outline-none"
          />
          <button onClick={() => submit()} disabled={!text.trim() || running} className="btn btn-primary h-10 w-10 justify-center p-0" aria-label="Send">
            {running ? <Spinner /> : <ArrowUp size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Command() {
  const snap = useApp((s) => s.snap);
  const st = snap?.stats;
  const s = snap?.settings;
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mint">Command Center</div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
            Your agent, <span className="text-gradient">on your terms.</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
          <span className={clsx('flex items-center gap-1.5 rounded-full border px-2.5 py-1', s?.agentMode === 'claude' ? 'border-violet/40 bg-violet/10 text-violet-200' : 'border-white/10 bg-white/5 text-ink-200')}>
            {s?.agentMode === 'claude' ? <Bot size={12} /> : <Cpu size={12} />} {s?.agentMode === 'claude' ? `Claude · ${s.model}` : 'Autopilot · on-device'}
          </span>
          <span>
            Ledger <span className="font-mono text-ink-200">{snap?.ledger.head.slice(0, 10)}…</span> · {snap?.ledger.count ?? 0} {snap?.ledger.count === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Calls inspected" value={st?.inspected ?? 0} icon={<Activity size={18} />} />
        <Stat label="Shared exact" value={st?.shared ?? 0} tone="ok" icon={<ShieldCheck size={18} />} hint="Fields sent as-is, allowed by your rules or your consent" />
        <Stat label="Minimized" value={(st?.minimized ?? 0) + (st?.tokenized ?? 0)} tone="warn" icon={<Waypoints size={18} />} hint="Coarsened, aliased, virtual-carded or tokenized" />
        <Stat label="Withheld" value={st?.withheld ?? 0} tone="bad" icon={<ShieldX size={18} />} />
        <Stat label="Threats stopped" value={st?.threats ?? 0} tone="bad" icon={<ShieldAlert size={18} />} hint="Prompt injections and exfiltration attempts quarantined" />
        <Stat label="Consents" value={st?.consentAsked ?? 0} tone="ask" icon={<Hand size={18} />} hint="Times the agent paused to ask you" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        <Chat />
        <div className="flex h-[calc(100vh-232px)] min-h-[560px] flex-col gap-4">
          <div className="panel grid-bg relative shrink-0 overflow-hidden p-3" data-demo="flowmap">
            <div className="absolute left-4 top-3 z-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
              </span>
              Live data flow
            </div>
            <FlowMap compact />
          </div>
          <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden" data-demo="feed">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles size={15} className="text-mint" /> Firewall decisions
              </div>
              <span className="text-[11px] text-ink-400">field-by-field · newest first</span>
            </div>
            <div className="flex-1 overflow-y-auto scroll-thin p-3">
              <FirewallFeed />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
