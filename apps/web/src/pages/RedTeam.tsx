import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { ClipboardX, FileWarning, Files, ImageOff, Play, ShieldCheck, ShieldX, Skull, Swords } from 'lucide-react';
import type { RedTeamReport } from '@consentry/core';
import { useApp } from '../lib/store';
import type { RedTeamInfo } from '../lib/client';
import { FirewallFeed } from '../components/FirewallFeed';
import { PageHeader, Spinner } from '../components/ui';

const ICONS: Record<string, typeof Skull> = { skull: Skull, 'image-off': ImageOff, 'clipboard-x': ClipboardX, files: Files, 'file-warning': FileWarning };

function Report({ r }: { r: RedTeamReport }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
      <div className={clsx('flex items-center gap-3 rounded-2xl border px-4 py-3', r.contained ? 'border-emerald-400/30 bg-emerald-500/[0.07]' : 'border-rose-400/40 bg-rose-500/10')}>
        <motion.div initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
          {r.contained ? <ShieldCheck size={26} className="text-emerald-300" /> : <ShieldX size={26} className="text-rose-300" />}
        </motion.div>
        <div>
          <div className={clsx('font-display text-sm font-bold uppercase tracking-[0.16em]', r.contained ? 'text-emerald-300' : 'text-rose-300')}>{r.contained ? 'Contained' : 'Leaked'}</div>
          <div className="text-[13px] text-white">{r.headline}</div>
        </div>
        <div className="ml-auto font-mono text-[11px] text-ink-400">{(r.durationMs / 1000).toFixed(1)}s</div>
      </div>
      <div className="space-y-1.5">
        {r.layers.map((l) => (
          <div key={l.name} className="flex items-start gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2">
            <span className={clsx('mt-0.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase', l.result === 'caught' ? 'bg-emerald-400/15 text-emerald-300' : l.result === 'passed' ? 'bg-rose-400/15 text-rose-300' : 'bg-white/5 text-ink-400')}>{l.result}</span>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-white">{l.name}</div>
              <div className="break-words text-[11.5px] text-ink-300">{l.detail}</div>
            </div>
          </div>
        ))}
      </div>
      {r.attempts.length > 0 && (
        <details className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2">
          <summary className="cursor-pointer text-[12px] font-medium text-ink-200">What the attack tried to move ({r.attempts.length})</summary>
          <div className="mt-2 space-y-1">
            {r.attempts.map((a, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-[11.5px]">
                <span className="truncate text-ink-300">
                  {a.label} → <span className="text-ink-200">{a.destination}</span>
                </span>
                <span className={clsx('font-mono', a.outcome.startsWith('shared') ? 'text-emerald-300' : a.outcome.startsWith('minimized') || a.outcome.startsWith('tokenized') ? 'text-amber-300' : 'text-rose-300')}>{a.outcome}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </motion.div>
  );
}

export default function RedTeam() {
  const client = useApp((s) => s.client);
  const [catalog, setCatalog] = useState<RedTeamInfo[]>([]);
  const [reports, setReports] = useState<Record<string, RedTeamReport>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    void client?.redteamCatalog().then(setCatalog);
  }, [client]);

  const run = async (id: string) => {
    setRunning(id);
    try {
      const r = await client!.runRedTeam(id);
      setReports((x) => ({ ...x, [id]: r }));
    } finally {
      setRunning(null);
    }
  };
  const runAll = async () => {
    setAll(true);
    setReports({});
    for (const s of catalog) await run(s.id);
    setAll(false);
  };
  const done = Object.values(reports);
  const contained = done.filter((r) => r.contained).length;

  return (
    <div>
      <PageHeader
        title="Red Team"
        icon={<Swords size={20} />}
        subtitle="Attack your own agent. Every scenario runs through the real firewall, ledger and tools."
        actions={
          <button className="btn btn-primary" onClick={runAll} disabled={!!running || !catalog.length}>
            {all ? <Spinner /> : <Play size={15} />} Run all {catalog.length} attacks
          </button>
        }
      />
      <AnimatePresence>
        {done.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="panel mb-5 flex items-center gap-5 overflow-hidden p-5">
            <div className="font-display text-5xl font-extrabold tabular-nums text-white">
              {contained}
              <span className="text-ink-500">/{done.length}</span>
            </div>
            <div>
              <div className="font-display text-lg font-bold text-emerald-300">attacks contained</div>
              <div className="text-[12.5px] text-ink-300">Zero SSNs, real card numbers or mental-health records left the vault, even with a fully compromised agent.</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid gap-4 lg:grid-cols-2">
          {catalog.map((s) => {
            const I = ICONS[s.icon] ?? Skull;
            const r = reports[s.id];
            return (
              <div key={s.id} className={clsx('panel p-5', running === s.id && 'ring-gradient')}>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-500/10 text-rose-300">
                    <I size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[15px] font-bold text-white">{s.title}</div>
                    <div className="text-[12px] text-rose-200/80">{s.tagline}</div>
                  </div>
                </div>
                <p className="mt-3 text-[12.5px] leading-relaxed text-ink-300">{s.attack}</p>
                <button className={clsx('btn mt-4 w-full justify-center', r ? 'btn-ghost' : 'btn-danger')} onClick={() => run(s.id)} disabled={!!running}>
                  {running === s.id ? (
                    <>
                      <Spinner /> Attacking…
                    </>
                  ) : (
                    <>
                      <Play size={14} /> {r ? 'Run again' : 'Launch attack'}
                    </>
                  )}
                </button>
                {r && <Report r={r} />}
              </div>
            );
          })}
        </div>
        <div className="panel flex max-h-[calc(100vh-180px)] flex-col overflow-hidden xl:sticky xl:top-6">
          <div className="border-b border-white/[0.06] px-4 py-3 text-sm font-semibold text-white">Live firewall feed</div>
          <div className="flex-1 overflow-y-auto scroll-thin p-3">
            <FirewallFeed limit={30} />
          </div>
        </div>
      </div>
    </div>
  );
}
