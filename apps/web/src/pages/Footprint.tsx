import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowDownToLine, Check, CircleDot, Copy, Eye, FileX2, Footprints, Radar, Send, ShieldCheck, ShieldAlert, X } from 'lucide-react';
import type { DataRequest, Footprint as FootprintData, FootprintGroup, FootprintRow, FootprintState } from '@consentry/core';
import { useApp } from '../lib/store';
import { Modal, PageHeader, Spinner, Stat, TierBadge, timeAgo } from '../components/ui';

// Validated against the dark surface (dataviz validate_palette.js): status colors always ship with an icon + label.
export const STATE_STYLE: Record<FootprintState, { label: string; color: string; icon: typeof Eye; desc: string }> = {
  exact: { label: 'Knows exactly', color: '#e11d48', icon: Eye, desc: 'They received the real value' },
  approx: { label: 'Knows approximately', color: '#d97706', icon: CircleDot, desc: 'Coarsened, aliased, tokenized or virtual' },
  protected: { label: 'Protected', color: '#059669', icon: ShieldCheck, desc: 'Asked for it, but it was withheld or blocked' },
};

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-[11.5px] text-ink-300">
      {(Object.keys(STATE_STYLE) as FootprintState[]).map((k) => {
        const s = STATE_STYLE[k];
        return (
          <span key={k} className="flex items-center gap-1.5" title={s.desc}>
            <span className="flex h-4 w-4 items-center justify-center rounded" style={{ background: s.color + '33', boxShadow: `inset 0 0 0 1px ${s.color}` }}>
              <s.icon size={10} style={{ color: s.color }} />
            </span>
            {s.label}
          </span>
        );
      })}
      <span className="flex items-center gap-1.5">
        <span className="h-4 w-4 rounded border border-dashed border-white/15" /> Never asked
      </span>
    </div>
  );
}

function Cell({ row, group, onOpen }: { row: FootprintRow; group: FootprintGroup; onOpen: () => void }) {
  const c = row.cells[group];
  const [hover, setHover] = useState(false);
  if (!c) return <div className="h-11 rounded-lg border border-dashed border-white/[0.07]" />;
  const s = STATE_STYLE[c.state];
  const total = c.items.reduce((a, i) => a + i.count, 0);
  return (
    <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button onClick={onOpen} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold text-white transition hover:brightness-125" style={{ background: s.color + '2e', boxShadow: `inset 0 0 0 1px ${s.color}aa` }} aria-label={`${row.name} · ${group}: ${s.label}`}>
        <s.icon size={13} style={{ color: s.color }} />
        <span className="hidden sm:inline">{c.state === 'exact' ? 'exact' : c.state === 'approx' ? 'approx' : 'safe'}</span>
        <span className="font-mono text-[10px] text-ink-300">×{total}</span>
      </button>
      <AnimatePresence>
        {hover && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-ink-850 p-3 text-left shadow-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              {row.name} · {group}
            </div>
            {c.items.map((i) => (
              <div key={i.label + i.action} className="mt-1.5 text-[12px]">
                <span className="font-semibold text-white">{i.label}</span> <span className="text-ink-400">×{i.count}</span>
                <div className="truncate font-mono text-[10.5px]" style={{ color: i.action === 'shared' ? '#fda4af' : i.action === 'withheld' ? '#6ee7b7' : '#fcd34d' }}>
                  {i.action === 'shared' ? 'exact value' : i.action === 'withheld' ? 'withheld' : i.form}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Timeline({ data }: { data: FootprintData['timeline'] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <div className="py-8 text-center text-[12.5px] text-ink-400">No agent runs yet.</div>;
  const max = Math.max(1, ...data.map((d) => d.exact + d.approx + d.withheld));
  const H = 150;
  const bw = Math.min(34, Math.max(14, 560 / data.length - 10));
  const gap = 10;
  const W = data.length * (bw + gap);
  return (
    <div className="relative">
      <div className="overflow-x-auto scroll-thin">
        <svg width={Math.max(W, 300)} height={H + 24} role="img" aria-label="Fields per agent run by outcome">
          {[0.5, 1].map((t) => (
            <line key={t} x1={0} x2={Math.max(W, 300)} y1={H - H * t} y2={H - H * t} stroke="rgba(255,255,255,0.06)" />
          ))}
          {data.map((d, i) => {
            const x = i * (bw + gap) + 4;
            let y = H;
            const segs: [number, string][] = [
              [d.exact, STATE_STYLE.exact.color],
              [d.approx, STATE_STYLE.approx.color],
              [d.withheld, STATE_STYLE.protected.color],
            ];
            return (
              <g key={d.runId} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'default' }}>
                <rect x={x - 4} y={0} width={bw + 8} height={H} fill="transparent" />
                {segs.map(([v, col], j) => {
                  if (!v) return null;
                  const h = (v / max) * (H - 8);
                  y -= h;
                  return <rect key={j} x={x} y={y + 1} width={bw} height={Math.max(2, h - 2)} rx={3} fill={col} opacity={hover === null || hover === i ? 1 : 0.45} />;
                })}
                {d.exact + d.approx + d.withheld === 0 && <rect x={x} y={H - 3} width={bw} height={3} rx={1.5} fill="rgba(255,255,255,0.18)" />}
                {d.threats > 0 && <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="11">☣️</text>}
                <text x={x + bw / 2} y={H + 16} textAnchor="middle" fontSize="10" fill="#77736a" fontFamily="JetBrains Mono">
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {hover !== null && data[hover] && (
        <div className="pointer-events-none absolute left-2 top-0 max-w-sm rounded-xl border border-white/10 bg-ink-850 p-3 text-[12px] shadow-2xl">
          <div className="font-semibold text-white">“{data[hover].prompt.length > 70 ? data[hover].prompt.slice(0, 68) + '…' : data[hover].prompt}”</div>
          <div className="mt-1 text-ink-300">
            <span style={{ color: '#fda4af' }}>{data[hover].exact} exact</span> · <span style={{ color: '#fcd34d' }}>{data[hover].approx} approx</span> · <span style={{ color: '#6ee7b7' }}>{data[hover].withheld} withheld</span>
            {data[hover].threats ? ` · ${data[hover].threats} threat(s)` : ''}
          </div>
          <div className="mt-0.5 text-[11px] text-ink-500">{timeAgo(data[hover].at)}</div>
        </div>
      )}
    </div>
  );
}

function RequestModal({ req, onClose }: { req: DataRequest | null; onClose: () => void }) {
  const client = useApp((s) => s.client);
  const snap = useApp((s) => s.snap);
  const live = snap?.requests.find((r) => r.id === req?.id) ?? req;
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  if (!live) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const send = async () => {
    setSending(true);
    await client?.sendRequest(live.id);
    setSending(false);
  };
  const download = () => {
    const blob = new Blob([`To: ${live.to}\nSubject: ${live.subject}\n\n${live.letter}\n`], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `deletion-request-${live.recipientId}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const steps: [DataRequest['status'], string][] = [
    ['drafted', 'Drafted from your ledger'],
    ['sent', 'Sent · aliases revoked'],
    ['confirmed', 'Deletion confirmed'],
  ];
  const idx = steps.findIndex(([s]) => s === live.status);
  return (
    <Modal open={!!req} onClose={onClose} wide>
      <div className="p-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-mint">
          <FileX2 size={13} /> Data-subject request
        </div>
        <h2 className="mt-1 font-display text-xl font-bold text-white">Delete what {live.recipientName} knows about you</h2>
        <div className="mt-4 flex items-center gap-2">
          {steps.map(([s, label], i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <motion.div animate={{ scale: i === idx ? [1, 1.15, 1] : 1 }} transition={{ duration: 0.6 }} className={clsx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold', i <= idx ? 'border-mint bg-mint/20 text-mint' : 'border-white/15 text-ink-500')}>
                {i < idx || live.status === 'confirmed' ? <Check size={13} /> : i + 1}
              </motion.div>
              <span className={clsx('text-[12px]', i <= idx ? 'text-white' : 'text-ink-500')}>{label}</span>
              {i < steps.length - 1 && <div className={clsx('h-px flex-1', i < idx ? 'bg-mint/60' : 'bg-white/10')} />}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="grid grid-cols-[64px_1fr] gap-y-1 text-[12px]">
            <span className="text-ink-500">To</span>
            <span className="font-mono text-ink-200">{live.to}</span>
            <span className="text-ink-500">Subject</span>
            <span className="text-ink-200">{live.subject}</span>
          </div>
          <pre className="mt-3 max-h-[42vh] overflow-y-auto scroll-thin whitespace-pre-wrap border-t border-white/10 pt-3 font-mono text-[11.5px] leading-relaxed text-ink-100">{live.letter}</pre>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {live.status === 'drafted' && (
            <button className="btn btn-primary" onClick={send} disabled={sending}>
              {sending ? <Spinner /> : <Send size={14} />} Send request (simulated)
            </button>
          )}
          {live.status === 'sent' && (
            <span className="flex items-center gap-2 rounded-xl bg-sky-400/10 px-3 py-2 text-[12.5px] text-sky-200">
              <Spinner /> Waiting for {live.recipientName} to confirm…
            </span>
          )}
          {live.status === 'confirmed' && (
            <span className="flex items-center gap-2 rounded-xl bg-emerald-400/10 px-3 py-2 text-[12.5px] text-emerald-200">
              <ShieldCheck size={15} /> {live.recipientName} confirmed deletion {live.confirmedAt ? timeAgo(live.confirmedAt) : ''}
            </span>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => {
              void navigator.clipboard?.writeText(`To: ${live.to}\nSubject: ${live.subject}\n\n${live.letter}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy letter'}
          </button>
          <button className="btn btn-ghost" onClick={download}>
            <ArrowDownToLine size={14} /> Download
          </button>
          <span className="ml-auto text-[11px] text-ink-500">Cites {live.evidence.length} ledger entries as evidence</span>
        </div>
      </div>
    </Modal>
  );
}

function Drawer({ row, onClose, onRequest }: { row: FootprintRow | null; onClose: () => void; onRequest: (r: FootprintRow) => void }) {
  return (
    <AnimatePresence>
      {row && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <motion.aside initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }} className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto scroll-thin border-l border-white/10 bg-ink-900 p-6">
            <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-ink-300 hover:bg-white/10" aria-label="Close">
              <X size={16} />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl">{row.emoji}</div>
              <div>
                <div className="font-display text-lg font-bold text-white">{row.name}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <TierBadge tier={row.tier} />
                  {row.simulated && <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">simulated</span>}
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {(['exact', 'approx', 'protected'] as const).map((k) => (
                <div key={k} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                  <div className="font-display text-xl font-bold text-white">{row[k]}</div>
                  <div className="text-[10.5px] text-ink-400">{STATE_STYLE[k].label.toLowerCase()}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-mint/25 bg-mint/[0.05] p-4">
              {row.tier === 'partner' ? (
                <>
                  <div className="text-[13px] font-semibold text-white">Make them forget you</div>
                  <p className="mt-1 text-[12px] text-ink-400">Consentry drafts a CCPA/GDPR deletion request listing exactly what {row.name} received, with your ledger entries as evidence.</p>
                  <button className="btn btn-primary mt-3" onClick={() => onRequest(row)}>
                    <FileX2 size={14} /> {row.request ? 'View deletion request' : 'Request deletion'}
                  </button>
                </>
              ) : row.tier === 'llm' ? (
                <p className="text-[12px] text-ink-400">The model provider only ever received tokens and the health context your policy allows. Retention follows your Anthropic org settings.</p>
              ) : (
                <p className="text-[12px] text-ink-400">{row.name} is an account-less public API. It received only coarsened, non-identifying queries, so there is no profile to delete.</p>
              )}
            <div className="mt-5 space-y-4">
              {Object.entries(row.cells).map(([g, c]) => (
                <div key={g}>
                  <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
                    {g}
                    <span className="rounded px-1.5 py-0.5 text-[9.5px] normal-case tracking-normal" style={{ background: STATE_STYLE[c!.state].color + '30', color: '#fff' }}>
                      {STATE_STYLE[c!.state].label}
                    </span>
                  </div>
                  {c!.items.map((i) => (
                    <div key={i.label + i.action} className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-1.5 text-[12.5px]">
                      <span className="text-ink-100">{i.label}</span>
                      <span className="truncate font-mono text-[11px]" style={{ color: i.action === 'shared' ? '#fda4af' : i.action === 'withheld' ? '#6ee7b7' : '#fcd34d' }}>
                        {i.action === 'shared' ? 'exact' : i.action === 'withheld' ? 'withheld' : i.form} ×{i.count}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Footprint() {
  const client = useApp((s) => s.client);
  const pulse = useApp((s) => s.ledgerPulse);
  const snap = useApp((s) => s.snap);
  const toast = useApp((s) => s.toast);
  const nav = useNavigate();
  const [fp, setFp] = useState<FootprintData | null>(null);
  const [open, setOpen] = useState<FootprintRow | null>(null);
  const [req, setReq] = useState<DataRequest | null>(null);

  const load = useCallback(async () => {
    if (client) setFp(await client.footprint());
  }, [client]);
  useEffect(() => {
    void load();
  }, [load, pulse]);

  const requestFor = async (row: FootprintRow) => {
    const existing = snap?.requests.filter((r) => r.recipientId === row.recipientId).slice(-1)[0];
    try {
      setReq(existing ?? (await client!.draftDeletion(row.recipientId)));
      setOpen(null);
    } catch (e: any) {
      toast({ tone: 'warn', title: 'Not needed', body: e.message });
    }
  };

  const rows = fp?.rows ?? [];
  const openRow = useMemo(() => (open ? rows.find((r) => r.recipientId === open.recipientId) ?? open : null), [open, rows]);

  return (
    <div>
      <PageHeader
        title="Your data footprint"
        icon={<Footprints size={20} />}
        subtitle="Who knows what about you, computed only from your hash-chained ledger"
        actions={<Legend />}
      />
      {!rows.length ? (
        <div className="panel flex flex-col items-center gap-3 py-16 text-center">
          <Radar size={30} className="text-ink-500" />
          <div className="font-display text-lg font-bold text-white">No footprint yet</div>
          <p className="max-w-md text-[13px] text-ink-400">Run a few scenarios, like the safety sweep or booking dinner, and this page will show every company and API that learned something about you, and how much.</p>
          <button className="btn btn-primary mt-2" onClick={() => nav('/')}>
            Go to Command Center
          </button>
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <Stat label="Know something" value={fp!.totals.recipients} icon={<Eye size={18} />} hint="Recipients that received any personal field, exact or approximate" />
            <Stat label="Exact disclosures" value={fp!.totals.exact} tone="bad" icon={<Eye size={18} />} />
            <Stat label="Approximate" value={fp!.totals.approx} tone="warn" icon={<CircleDot size={18} />} />
            <Stat label="Protected" value={fp!.totals.protected} tone="ok" icon={<ShieldCheck size={18} />} />
            <Stat label="Threats stopped" value={fp!.totals.threats + fp!.totals.blockedCalls} tone="bad" icon={<ShieldAlert size={18} />} hint="Quarantined injections plus blocked calls" />
          </div>
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <div className="panel overflow-x-auto scroll-thin p-5" data-demo="matrix">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Who knows what</div>
                <div className="text-[11px] text-ink-400">hover a cell for detail · click a row for actions</div>
              </div>
              <div className="min-w-[680px]">
                <div className="grid grid-cols-[220px_repeat(6,minmax(0,1fr))] gap-2 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                  <span>Recipient</span>
                  {fp!.groups.map((g) => (
                    <span key={g} className="text-center">
                      {g}
                    </span>
                  ))}
                </div>
                <div className="space-y-2">
                  {rows.map((r, idx) => (
                    <motion.div key={r.recipientId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }} className="grid grid-cols-[220px_repeat(6,minmax(0,1fr))] items-center gap-2">
                      <button onClick={() => setOpen(r)} className="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-white/5">
                        <span className="text-lg">{r.emoji ?? '❓'}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-white">{r.name}</span>
                          <span className="block text-[10.5px] text-ink-400">
                            {r.calls} call{r.calls === 1 ? '' : 's'} · {r.lastAt ? timeAgo(r.lastAt) : ''}
                            {r.request && <span className={clsx('ml-1.5 font-semibold', r.request === 'confirmed' ? 'text-emerald-300' : 'text-sky-300')}>· deletion {r.request}</span>}
                          </span>
                        </span>
                      </button>
                      {fp!.groups.map((g) => (
                        <Cell key={g} row={r} group={g} onOpen={() => setOpen(r)} />
                      ))}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-5">
              <div className="panel p-5">
                <div className="mb-1 text-sm font-semibold text-white">Fields per agent run</div>
                <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-ink-400">
                  {(['exact', 'approx', 'protected'] as const).map((k) => (
                    <span key={k} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATE_STYLE[k].color }} /> {k === 'protected' ? 'withheld' : k === 'approx' ? 'minimized' : 'exact'}
                    </span>
                  ))}
                  <span>☣️ threat</span>
                </div>
                <Timeline data={fp!.timeline} />
              </div>
              <div className="panel p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <FileX2 size={15} className="text-mint" /> Deletion requests
                </div>
                {snap?.requests.length ? (
                  <div className="space-y-2">
                    {[...snap.requests].reverse().map((r) => (
                      <button key={r.id} onClick={() => setReq(r)} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-left hover:border-mint/30">
                        <FileX2 size={15} className="text-ink-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-white">{r.recipientName}</span>
                          <span className="block text-[11px] text-ink-400">{timeAgo(r.createdAt)} · {r.evidence.length} ledger entries cited</span>
                        </span>
                        <span className={clsx('rounded-md px-2 py-0.5 text-[10.5px] font-semibold uppercase', r.status === 'confirmed' ? 'bg-emerald-400/15 text-emerald-300' : r.status === 'sent' ? 'bg-sky-400/15 text-sky-300' : 'bg-white/10 text-ink-200')}>{r.status}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-ink-400">Click a partner row (e.g. TableTap) and choose “Request deletion”. The letter lists exactly what they received, with your ledger as evidence.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      <Drawer row={openRow} onClose={() => setOpen(null)} onRequest={requestFor} />
      <RequestModal req={req} onClose={() => setReq(null)} />
    </div>
  );
}
