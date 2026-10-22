import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { ArrowDownToLine, Bot, FileWarning, Hand, KeyRound, Receipt, RotateCcw, ScrollText, ShieldAlert, ShieldCheck, Sparkles, Undo2, UploadCloud } from 'lucide-react';
import type { LedgerEntry, LedgerVerification } from '@consentry/core';
import { useApp, recipientName } from '../lib/store';
import { ActionTag, PageHeader, Spinner, VerdictPill, fmtTime, timeAgo } from '../components/ui';

const KIND_ICON: Record<string, typeof ScrollText> = { egress: UploadCloud, ingress: ShieldAlert, consent: Hand, policy: KeyRound, grant: Sparkles, revoke: Undo2, system: ScrollText, llm: Bot };
const KIND_COLOR: Record<string, string> = { egress: '#efa56f', ingress: '#fb7185', consent: '#60a5fa', policy: '#a78bfa', grant: '#34d399', revoke: '#fbbf24', system: '#a7a196', llm: '#c4b5fd' };

function blockColor(e: LedgerEntry) {
  if (e.verdict === 'blocked' || e.verdict === 'quarantined') return '#fb7185';
  if (e.kind === 'egress') return e.verdict === 'minimized' ? '#fbbf24' : e.verdict === 'consented' ? '#60a5fa' : '#34d399';
  return KIND_COLOR[e.kind] ?? '#a7a196';
}

export default function Ledger() {
  const client = useApp((s) => s.client);
  const pulse = useApp((s) => s.ledgerPulse);
  const runs = useApp((s) => s.runs);
  const snap = useApp((s) => s.snap);
  const openReceipt = useApp((s) => s.openReceipt);
  const toast = useApp((s) => s.toast);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [verify, setVerify] = useState<LedgerVerification | null>(null);
  const [scanIdx, setScanIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<'log' | 'receipts'>('log');

  const load = useCallback(async () => {
    if (client) setEntries(await client.ledger(400));
  }, [client]);
  useEffect(() => {
    void load();
  }, [load, pulse]);

  const chain = [...entries].reverse().slice(-48);

  const runVerify = async () => {
    if (!client) return;
    setBusy('verify');
    setVerify(null);
    const result = await client.verifyLedger();
    const stopAt = result.ok ? chain.length : Math.max(0, chain.findIndex((e) => e.seq === result.brokenAt));
    for (let i = 0; i <= Math.min(stopAt, chain.length - 1); i++) {
      setScanIdx(i);
      await new Promise((r) => setTimeout(r, 28));
    }
    setScanIdx(null);
    setVerify(result);
    setBusy(null);
    toast(result.ok ? { tone: 'ok', title: 'Hash chain verified', body: `${result.checked} entries · head ${result.head?.slice(0, 12)}…` } : { tone: 'bad', title: `Tampering detected at #${result.brokenAt}`, body: 'Recomputed hash does not match the stored one.' });
  };

  const tamper = async () => {
    setBusy('tamper');
    await client?.tamperLedger();
    await load();
    setVerify(null);
    setBusy(null);
    toast({ tone: 'warn', title: 'History rewritten (demo)', body: 'An egress entry now claims nothing was shared. Verify the chain to catch it.' });
  };

  const repair = async () => {
    setBusy('repair');
    const v = await client!.repairLedger();
    await load();
    setVerify(v);
    setBusy(null);
  };

  const exportIt = async () => {
    const data = await client!.exportLedger();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `consentry-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const receipts = Object.values(runs).filter((r) => r.receipt).sort((a, b) => b.startedAt - a.startedAt);
  const broken = verify && !verify.ok ? verify.brokenAt : undefined;

  return (
    <div>
      <PageHeader
        title="Consent ledger"
        icon={<ScrollText size={20} />}
        subtitle="Append-only · SHA-256 hash chain over canonical JSON · stores masked values and payload digests, never your raw data"
        actions={
          <>
            <button className="btn btn-primary" onClick={runVerify} disabled={!!busy} data-demo="verify">
              {busy === 'verify' ? <Spinner /> : <ShieldCheck size={15} />} Verify chain
            </button>
            <button className="btn btn-danger" onClick={tamper} disabled={!!busy} title="Simulate an insider editing history" data-demo="tamper">
              {busy === 'tamper' ? <Spinner /> : <FileWarning size={15} />} Tamper (demo)
            </button>
            {verify && !verify.ok && (
              <button className="btn btn-ghost" onClick={repair} disabled={!!busy}>
                <RotateCcw size={15} /> Re-seal
              </button>
            )}
            <button className="btn btn-ghost" onClick={exportIt}>
              <ArrowDownToLine size={15} /> Export
            </button>
          </>
        }
      />

      <div className="panel mb-5 p-5">
        <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-400">
          <span>Last {chain.length} blocks</span>
          {verify && (
            <span className={verify.ok ? 'text-emerald-300' : 'text-rose-300'}>
              {verify.ok ? `✓ ${verify.checked} entries verified` : `✗ broken at #${verify.brokenAt}: expected ${verify.expected?.slice(0, 10)}… found ${verify.found?.slice(0, 10)}…`}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {chain.map((e, i) => {
            const isBroken = broken !== undefined && e.seq >= broken;
            const scanned = scanIdx !== null && i <= scanIdx;
            return (
              <div key={e.seq} className="flex items-center gap-1">
                <motion.div
                  title={`#${e.seq} ${e.summary}\n${e.hash}`}
                  animate={{ scale: scanIdx === i ? 1.35 : 1, opacity: scanIdx !== null && !scanned ? 0.35 : 1 }}
                  className={clsx('flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-[9px] font-semibold', isBroken ? 'border-rose-400 bg-rose-500/25 text-rose-100' : 'border-white/10 text-ink-950')}
                  style={!isBroken ? { background: blockColor(e), boxShadow: scanned ? `0 0 14px ${blockColor(e)}` : undefined } : undefined}
                >
                  {e.seq}
                </motion.div>
                {i < chain.length - 1 && <div className={clsx('h-px w-1.5', isBroken ? 'bg-rose-400' : 'bg-white/15')} />}
              </div>
            );
          })}
        </div>
        <div className="mt-3 font-mono text-[11px] text-ink-400">
          head <span className="text-ink-200">{snap?.ledger.head}</span>
        </div>
      </div>

      <div className="mb-3 flex gap-1 rounded-xl bg-white/[0.04] p-1 text-[12.5px] font-medium sm:w-fit">
        {(
          [
            ['log', `Entries (${entries.length})`],
            ['receipts', `Privacy receipts (${receipts.length})`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={clsx('flex-1 rounded-lg px-3 py-1.5 sm:flex-none', tab === k ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-white')}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'log' ? (
        <div className="panel overflow-hidden">
          <div className="max-h-[62vh] overflow-y-auto scroll-thin">
            {entries.map((e) => {
              const I = KIND_ICON[e.kind] ?? ScrollText;
              const isBroken = broken !== undefined && e.seq === broken;
              return (
                <div key={e.seq} className={clsx('grid grid-cols-[56px_minmax(0,1fr)] gap-3 border-b border-white/[0.05] px-4 py-3 sm:grid-cols-[56px_minmax(0,1fr)_170px]', isBroken && 'bg-rose-500/10')}>
                  <div className="flex items-center gap-1.5">
                    <I size={14} style={{ color: KIND_COLOR[e.kind] }} />
                    <span className="font-mono text-[11px] text-ink-400">#{e.seq}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] text-ink-100">{e.summary}</span>
                      {e.verdict && ['clean', 'allowed', 'minimized', 'consented', 'blocked', 'quarantined'].includes(e.verdict) && <VerdictPill verdict={e.verdict as any} />}
                    </div>
                    {e.fields && e.fields.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {e.fields.map((f, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-0.5 text-[11px] text-ink-300">
                            {f.item ?? f.category} <ActionTag action={f.action} /> <span className="font-mono text-[10.5px] text-ink-400">{f.after}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 font-mono text-[10px] text-ink-500 sm:hidden">{e.hash.slice(0, 20)}…</div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <div className="text-[11px] text-ink-400" title={new Date(e.ts).toLocaleString()}>
                      {fmtTime(e.ts)} · {timeAgo(e.ts)}
                    </div>
                    {e.recipientId && <div className="text-[11px] text-ink-300">{recipientName(snap, e.recipientId)}</div>}
                    <div className="font-mono text-[10px] text-ink-500" title={e.hash}>
                      {e.hash.slice(0, 16)}…
                    </div>
                    {e.payloadDigest && (
                      <div className="font-mono text-[9.5px] text-ink-600" title="SHA-256 of the exact payload that left">
                        payload {e.payloadDigest.slice(0, 10)}…
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {receipts.length === 0 && <div className="text-sm text-ink-400">Run something in the Command Center to get your first receipt.</div>}
          {receipts.map((r) => (
            <button key={r.runId} onClick={() => openReceipt(r.runId)} className="panel p-4 text-left transition hover:border-mint/30">
              <div className="flex items-center gap-2 text-[11px] text-ink-400">
                <Receipt size={13} className="text-mint" /> {new Date(r.startedAt).toLocaleString()}
              </div>
              <div className="mt-1.5 line-clamp-2 text-[13.5px] font-medium text-white">{r.prompt}</div>
              <div className="mt-2 text-[11.5px] text-ink-400">
                {r.receipt!.calls.length} calls · <span className="text-emerald-300">{r.receipt!.shared.filter((s) => s.form === 'exact').length} exact</span> · <span className="text-amber-300">{r.receipt!.shared.filter((s) => s.form !== 'exact').length} minimized</span> · <span className="text-rose-300">{r.receipt!.withheld.length} withheld</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
