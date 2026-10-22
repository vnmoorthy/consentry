import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Bot, Hand, ShieldAlert, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { PURPOSES } from '@consentry/core';
import { useApp, recipientName, type FeedItem } from '../lib/store';
import { ActionTag, CategoryIcon, VerdictPill, fmtTime } from './ui';

function Field({ d }: { d: import('@consentry/core').FieldDecision }) {
  const changed = d.action !== 'shared';
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5 gap-y-0.5 py-1.5">
      <CategoryIcon category={d.category} size={14} className="mt-0.5" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-semibold text-ink-100">{d.itemLabel}</span>
          <ActionTag action={d.action} />
          {d.viaConsent && <span className="rounded-md bg-sky-400/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-sky-300">your call</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <span className={clsx('truncate', changed ? 'text-ink-400 line-through decoration-rose-400/60' : 'text-emerald-200')}>{d.before}</span>
          {changed && (
            <>
              <ArrowRight size={11} className="shrink-0 text-ink-500" />
              <span className={clsx('truncate', d.action === 'withheld' ? 'text-rose-300' : d.action === 'tokenized' ? 'text-violet-300' : 'text-amber-200')}>{d.after}</span>
            </>
          )}
        </div>
        {d.ruleTitle && <div className="mt-0.5 truncate text-[10.5px] text-ink-400">↳ {d.ruleTitle}</div>}
      </div>
    </div>
  );
}

export function FeedCard({ item }: { item: FeedItem }) {
  const snap = useApp((s) => s.snap);
  if (item.kind === 'egress') {
    const r = item.result;
    const rec = snap?.recipients.find((x) => x.id === item.recipientId);
    return (
      <div className={clsx('rounded-2xl border p-3', r.verdict === 'blocked' ? 'border-rose-400/30 bg-rose-500/[0.06]' : 'border-white/[0.07] bg-white/[0.025]')}>
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{rec?.emoji ?? '❓'}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold text-white">
              {item.tool.replace(/_/g, ' ')} <span className="text-ink-500">→</span> {recipientName(snap, item.recipientId)}
            </div>
            <div className="text-[10.5px] text-ink-400">
              {PURPOSES[item.purpose]} · {fmtTime(item.ts)} {r.ledgerSeq ? `· ledger #${r.ledgerSeq}` : ''}
            </div>
          </div>
          <VerdictPill verdict={r.verdict} />
        </div>
        {r.blockedReason && <div className="mt-2 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-[11.5px] text-rose-200">⛔ {r.blockedReason}</div>}
        {r.decisions.length > 0 ? (
          <div className="mt-1.5 divide-y divide-white/[0.05]">
            {r.decisions.map((d) => (
              <Field key={d.findingId} d={d} />
            ))}
          </div>
        ) : (
          !r.blockedReason && <div className="mt-1.5 text-[11.5px] text-ink-400">No personal data in this request — only the public query.</div>
        )}
      </div>
    );
  }
  if (item.kind === 'ingress') {
    const t = item.result.threats[0];
    return (
      <motion.div initial={{ boxShadow: '0 0 0 0 rgba(244,63,94,0.6)' }} animate={{ boxShadow: ['0 0 0 0 rgba(244,63,94,0.5)', '0 0 0 12px rgba(244,63,94,0)'] }} transition={{ duration: 1.2, repeat: 2 }} className="rounded-2xl border border-rose-400/40 bg-rose-500/[0.08] p-3">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-rose-300" />
          <div className="flex-1 text-[12.5px] font-semibold text-rose-100">
            {t ? (t.kind === 'exfil-url' ? 'Exfiltration URL quarantined' : 'Prompt injection quarantined') : 'Smuggled vault tokens neutralized'}
            <span className="font-normal text-rose-200/70"> · from {recipientName(snap, item.recipientId)}</span>
          </div>
          <VerdictPill verdict="quarantined" />
        </div>
        {t && (
          <>
            <div className="mt-2 rounded-lg border border-rose-400/20 bg-black/40 p-2 font-mono text-[10.5px] leading-relaxed text-rose-200/90">“{t.excerpt}”</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {t.signals.map((s) => (
                <span key={s} className="rounded-md bg-rose-400/10 px-1.5 py-0.5 text-[10px] text-rose-200">{s}</span>
              ))}
              <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-ink-300">score {t.score}</span>
            </div>
          </>
        )}
        <div className="mt-2 text-[11px] text-rose-200/70">Removed {item.result.removed} segment(s) before the agent read it · run is now tainted: sensitive data locked.</div>
      </motion.div>
    );
  }
  if (item.kind === 'llm') {
    return (
      <div className="rounded-2xl border border-violet-400/25 bg-violet-500/[0.06] p-3">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-violet-300" />
          <div className="flex-1 text-[12.5px] font-semibold text-white">
            Prompt <span className="text-ink-500">→</span> Claude (LLM)
          </div>
          <VerdictPill verdict={item.decisions.length ? 'minimized' : 'clean'} />
        </div>
        <div className="mt-2 rounded-lg bg-black/40 p-2 font-mono text-[11px] leading-relaxed text-ink-200">
          {item.sanitized.split(/(\{\{vault:[a-z0-9_]+\}\}|\[[^\]]+ withheld\])/g).map((part, i) =>
            /^\{\{vault:/.test(part) ? (
              <span key={i} className="rounded bg-violet-400/20 px-1 text-violet-200">{part}</span>
            ) : /withheld\]$/.test(part) ? (
              <span key={i} className="rounded bg-rose-400/20 px-1 text-rose-200">{part}</span>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </div>
        {item.decisions.length > 0 && (
          <div className="mt-1.5 divide-y divide-white/[0.05]">
            {item.decisions.map((d) => (
              <Field key={d.findingId} d={d} />
            ))}
          </div>
        )}
      </div>
    );
  }
  const req = item.request;
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-500/[0.05] px-3 py-2.5">
      <Hand size={15} className="text-sky-300" />
      <div className="min-w-0 flex-1 text-[12px] text-ink-200">
        <span className="font-semibold text-white">Consent</span>: {req.items.map((i) => i.itemLabel).join(', ')} → {req.recipientName}
      </div>
      <span className={clsx('rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase', item.decision ? (item.decision === 'deny' ? 'bg-rose-400/10 text-rose-300' : item.decision === 'minimize' ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300') : 'shimmer text-sky-200')}>
        {item.decision ? item.decision.replace('_', ' ') : 'waiting'}
      </span>
    </div>
  );
}

export function FirewallFeed({ limit = 40, runId }: { limit?: number; runId?: string }) {
  const feed = useApp((s) => s.feed);
  const items = (runId ? feed.filter((f) => ('runId' in f ? f.runId === runId : f.kind === 'consent' && f.request.runId === runId)) : feed).slice(0, limit);
  if (!items.length)
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <ShieldCheck size={28} className="text-ink-500" />
        <div className="text-sm font-medium text-ink-300">Nothing has left your device yet</div>
        <div className="max-w-xs text-xs text-ink-400">Every outbound request your agent makes will appear here, field by field, with the rule that decided it.</div>
      </div>
    );
  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <motion.div key={it.id} layout initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 34 }}>
            <FeedCard item={it} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
