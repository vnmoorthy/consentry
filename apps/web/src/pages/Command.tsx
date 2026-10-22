import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Activity, ArrowUp, Bot, ChevronDown, Cpu, Eraser, Hand, Receipt, ShieldAlert, ShieldCheck, Skull, Sparkles, Waypoints, ShieldX } from 'lucide-react';
import { useApp, type CallView, type RunView } from '../lib/store';
import { FlowMap } from '../components/FlowMap';
import { FirewallFeed } from '../components/FirewallFeed';
import { Logo, Markdown, Spinner, Stat, VERDICT_STYLE } from '../components/ui';

export const SCENARIOS = [
  { emoji: '🌲', label: 'Hike + asthma', prompt: 'Is Saturday good for a hike in Yosemite with my asthma?' },
  { emoji: '🛡️', label: 'Safety sweep', prompt: 'Do a safety sweep: has anything I own or take been recalled?' },
  { emoji: '🍽️', label: 'Book dinner', prompt: 'Book a vegetarian dinner for 2 tonight at 7:30' },
  { emoji: '🚕', label: 'Ride home', prompt: 'Get me a ride home from Verdant Kitchen at 9:30 PM' },
  { emoji: '💊', label: 'Refill inhaler', prompt: 'Refill my inhaler' },
  { emoji: '🌋', label: 'Quakes nearby', prompt: 'Any earthquakes near me this month?' },
  { emoji: '🧾', label: 'What did you share?', prompt: 'What have you shared about me?' },
];

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

function AssistantTurn({ text, runId }: { text?: string; runId?: string }) {
  const run = useApp((s) => (runId ? s.runs[runId] : undefined));
  const openReceipt = useApp((s) => s.openReceipt);
  const [open, setOpen] = useState(true);
  const running = run?.status === 'running';
  useEffect(() => {
    if (run?.status === 'done' && text) {
      const t = setTimeout(() => setOpen(false), 1200);
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
            {run.agent === 'claude' ? <Bot size={12} /> : run.agent === 'compromised' ? <Skull size={12} className="text-rose-300" /> : <Cpu size={12} />}
            {running ? 'Working' : 'Agent trace'} · {run.calls.length} call{run.calls.length === 1 ? '' : 's'}
            <ChevronDown size={12} className={clsx('transition-transform', open && 'rotate-180')} />
          </button>
        )}
        {run && <Trace run={run} open={open || running} />}
        {text ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.03] px-4 py-3">
            <Markdown text={text} />
            {r && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-2.5">
                <button onClick={() => openReceipt(r.runId)} className="inline-flex items-center gap-1.5 rounded-lg bg-mint/10 px-2.5 py-1 text-[11.5px] font-semibold text-mint hover:bg-mint/20">
                  <Receipt size={13} /> Privacy receipt
                </button>
                <span className="text-[11px] text-ink-400">
                  {r.calls.length} calls · {r.recipients.length} recipients · <span className="text-amber-300">{minimized} minimized</span> · <span className="text-rose-300">{withheld} withheld</span>
                  {r.threats.length > 0 && <span className="text-rose-300"> · {r.threats.length} threat{r.threats.length > 1 ? 's' : ''} quarantined</span>}
                </span>
              </div>
            )}
          </motion.div>
        ) : (
          running && (
            <div className="flex items-center gap-2 text-[12.5px] text-ink-300">
              <Spinner /> {useApp.getState().consents.some((c) => c.runId === runId) ? 'Waiting for your consent…' : 'Working through the firewall…'}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Chat() {
  const chat = useApp((s) => s.chat);
  const runs = useApp((s) => s.runs);
  const send = useApp((s) => s.send);
  const clear = useApp((s) => s.clearChat);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const running = Object.values(runs).some((r) => r.status === 'running');
  const pendingRuns = Object.values(runs).filter((r) => r.status === 'running' && !chat.some((c) => c.role === 'assistant' && c.runId === r.runId));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.length, pendingRuns.length, JSON.stringify(pendingRuns.map((r) => [r.steps.length, r.calls.length]))]);

  const submit = (t = text) => {
    if (!t.trim() || running) return;
    void send(t);
    setText('');
  };

  return (
    <div className="panel flex h-[calc(100vh-232px)] min-h-[560px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles size={15} className="text-mint" /> Personal agent
        </div>
        <button onClick={() => void clear()} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] text-ink-400 hover:bg-white/5 hover:text-white" title="Clear conversation">
          <Eraser size={13} /> New chat
        </button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto scroll-thin px-5 py-5">
        {chat.length === 0 && pendingRuns.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Logo size={54} />
            <h3 className="mt-4 font-display text-xl font-bold text-white">Ask your agent anything</h3>
            <p className="mt-1.5 max-w-sm text-[13px] text-ink-300">It can reach 12 live public-data APIs and 5 partner services. Every request crosses the Consentry firewall first, so watch the live flow map.</p>
          </div>
        )}
        {chat.map((m) =>
          m.role === 'user' ? (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-gradient-to-br from-mint/20 to-violet/20 px-4 py-2.5 text-[13.5px] text-white ring-1 ring-white/10">{m.text}</div>
            </motion.div>
          ) : (
            <AssistantTurn key={m.id} text={m.text} runId={m.runId} />
          ),
        )}
        {pendingRuns.map((r) => (
          <AssistantTurn key={r.runId} runId={r.runId} />
        ))}
        <div ref={endRef} />
      </div>
      <div className="border-t border-white/[0.06] p-3">
        <div className="mb-2.5 flex gap-1.5 overflow-x-auto scroll-thin pb-1">
          {SCENARIOS.map((s) => (
            <button key={s.label} disabled={running} onClick={() => submit(s.prompt)} className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-ink-200 transition hover:border-mint/40 hover:bg-mint/10 hover:text-white disabled:opacity-40" title={s.prompt}>
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/30 p-2 focus-within:border-mint/40">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={running ? 'Agent is working…' : 'Ask your agent… (it never sees your raw data)'}
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
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mint">Command Center</div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
            Your agent, <span className="text-gradient">on your terms.</span>
          </h1>
        </div>
        <div className="text-right text-xs text-ink-400">
          Ledger head <span className="font-mono text-ink-200">{snap?.ledger.head.slice(0, 12)}…</span> · {snap?.ledger.count ?? 0} {snap?.ledger.count === 1 ? 'entry' : 'entries'}
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Calls inspected" value={st?.inspected ?? 0} icon={<Activity size={18} />} />
        <Stat label="Shared exact" value={st?.shared ?? 0} tone="ok" icon={<ShieldCheck size={18} />} hint="Fields sent as-is, allowed by your rules or your consent" />
        <Stat label="Minimized" value={(st?.minimized ?? 0) + (st?.tokenized ?? 0)} tone="warn" icon={<Waypoints size={18} />} hint="Coarsened, aliased, virtual-carded or tokenized" />
        <Stat label="Withheld" value={st?.withheld ?? 0} tone="bad" icon={<ShieldX size={18} />} />
        <Stat label="Threats quarantined" value={st?.threats ?? 0} tone="bad" icon={<ShieldAlert size={18} />} />
        <Stat label="Consents asked" value={st?.consentAsked ?? 0} tone="ask" icon={<Hand size={18} />} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        <Chat />
        <div className="flex h-[calc(100vh-232px)] min-h-[560px] flex-col gap-4">
          <div className="panel grid-bg relative shrink-0 overflow-hidden p-3">
            <div className="absolute left-4 top-3 z-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
              </span>
              Live data flow
            </div>
            <FlowMap compact />
          </div>
          <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldCheck size={15} className="text-mint" /> Firewall decisions
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
