import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { CalendarClock, Check, Hand, ShieldCheck, X } from 'lucide-react';
import { PURPOSES, type ConsentDecision } from '@consentry/core';
import { useApp } from '../lib/store';
import { CategoryIcon, TierBadge } from './ui';

export function ConsentModal() {
  const consents = useApp((s) => s.consents);
  const answer = useApp((s) => s.answerConsent);
  const snap = useApp((s) => s.snap);
  const req = consents[0];
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!req) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [req]);

  const hasMin = !!req?.items.some((i) => i.minimizedPreview);
  useEffect(() => {
    if (!req) return;
    const h = (e: KeyboardEvent) => {
      const map: Record<string, ConsentDecision> = { '1': hasMin ? 'minimize' : 'allow_once', '2': 'allow_once', '3': 'allow_always', '4': 'deny' };
      if (map[e.key] && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) answer(req.id, map[e.key]);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [req, hasMin, answer]);

  const rec = snap?.recipients.find((r) => r.id === req?.recipientId);
  const total = req ? req.expiresAt - req.createdAt : 1;
  const left = req ? Math.max(0, req.expiresAt - now) : 0;

  return (
    <AnimatePresence>
      {req && (
        <motion.div key={req.id} className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ y: 40, scale: 0.96, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ type: 'spring', stiffness: 360, damping: 30 }} className="ring-gradient relative w-full max-w-md overflow-hidden rounded-3xl bg-ink-900 shadow-[0_30px_120px_-20px_rgba(239,165,111,0.32)]">
            <div className="h-1 w-full bg-white/5">
              <motion.div className="h-full bg-gradient-to-r from-mint to-violet" style={{ width: `${(left / total) * 100}%` }} />
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-mint">
                <Hand size={13} /> Consent required {consents.length > 1 && <span className="text-ink-400">· {consents.length - 1} more waiting</span>}
              </div>
              <div className="mt-3 flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl">{rec?.emoji ?? '❓'}</div>
                <div>
                  <h2 className="font-display text-xl font-bold leading-tight text-white">
                    {req.recipientName} wants {req.items.length === 1 ? 'one piece' : `${req.items.length} pieces`} of your data
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-300">
                    <TierBadge tier={req.tier} />
                    <span className="rounded-full border border-white/10 px-2 py-0.5">{PURPOSES[req.purpose]}</span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono">{req.tool}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {req.items.map((it) => (
                  <div key={it.findingId} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
                    <div className="flex items-center gap-2">
                      <CategoryIcon category={it.category} />
                      <span className="text-sm font-semibold text-white">{it.itemLabel}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11.5px]">
                      <div className="rounded-xl bg-black/30 p-2">
                        <div className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-400">Exact</div>
                        <div className="mt-0.5 break-words font-mono text-ink-100">{it.preview}</div>
                      </div>
                      <div className="rounded-xl bg-amber-400/[0.06] p-2">
                        <div className="text-[9.5px] font-semibold uppercase tracking-wider text-amber-300/80">Minimized</div>
                        <div className="mt-0.5 break-words font-mono text-amber-100">{it.minimizedPreview ?? '— not available'}</div>
                      </div>
                    </div>
                    {it.ruleTitle && <div className="mt-2 text-[11px] text-ink-400">Your rule: “{it.ruleTitle}”</div>}
                  </div>
                ))}
              </div>
              {rec?.retention && <div className="mt-3 text-[11px] text-ink-400">Their stated retention: <span className="text-ink-200">{rec.retention}</span></div>}

              <div className="mt-5 grid gap-2">
                {hasMin && (
                  <button className="btn btn-primary justify-center py-3" onClick={() => answer(req.id, 'minimize')}>
                    <ShieldCheck size={16} /> Share minimized version <span className="ml-1 rounded-md border border-black/25 bg-black/15 px-1.5 font-mono text-[10.5px] font-bold text-ink-950">1</span>
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn btn-ghost justify-center" onClick={() => answer(req.id, 'allow_once')}>
                    <Check size={15} /> Allow once <span className="kbd">2</span>
                  </button>
                  <button className="btn btn-ghost justify-center" onClick={() => answer(req.id, 'allow_always')}>
                    <CalendarClock size={15} /> 30 days <span className="kbd">3</span>
                  </button>
                </div>
                <button className="btn btn-danger justify-center" onClick={() => answer(req.id, 'deny')}>
                  <X size={15} /> Deny <span className="kbd">4</span>
                </button>
              </div>
              <div className="mt-3 text-center text-[10.5px] text-ink-500">Auto-denies in {Math.ceil(left / 1000)}s · every decision is written to your ledger</div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
