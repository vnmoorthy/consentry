import { useEffect, useState } from 'react';
import { CATEGORIES } from '@consentry/core';
import { useApp, recipientName } from '../lib/store';
import { Modal } from './ui';

function Row({ l, r, cls }: { l: string; r: string; cls?: string }) {
  return (
    <div className={`flex justify-between gap-3 ${cls ?? ''}`}>
      <span className="min-w-0 truncate">{l}</span>
      <span className="shrink-0 text-right">{r}</span>
    </div>
  );
}

function Barcode({ hash }: { hash: string }) {
  const bars = hash.slice(0, 48).split('').map((c) => parseInt(c, 16));
  return (
    <div className="flex h-10 items-stretch justify-center gap-[2px]">
      {bars.map((b, i) => (
        <div key={i} style={{ width: (b % 3) + 1, background: '#1a1a1a', opacity: b > 2 ? 1 : 0.2 }} />
      ))}
    </div>
  );
}

export function ReceiptModal() {
  const runId = useApp((s) => s.receiptOpen);
  const close = useApp((s) => s.openReceipt);
  const run = useApp((s) => (runId ? s.runs[runId] : undefined));
  const snap = useApp((s) => s.snap);
  const client = useApp((s) => s.client);
  const [verified, setVerified] = useState<boolean | null>(null);
  const r = run?.receipt;

  useEffect(() => {
    if (!runId) return;
    setVerified(null);
    client?.verifyLedger().then((v) => setVerified(v.ok));
  }, [runId, client]);

  return (
    <Modal open={!!r} onClose={() => close(null)} className="!bg-transparent !border-0 !shadow-none max-w-sm">
      {r && (
        <div className="receipt-edge mx-auto bg-[#f4f1ea] px-7 py-9 font-mono text-[11.5px] leading-relaxed text-[#1c1c1c]">
          <div className="text-center">
            <div className="text-lg font-bold tracking-[0.25em]">CONSENTRY</div>
            <div className="text-[10px] tracking-[0.3em] text-[#555]">PRIVACY RECEIPT</div>
          </div>
          <div className="my-3 border-t border-dashed border-[#999]" />
          <Row l="RUN" r={r.runId.slice(4, 14).toUpperCase()} />
          <Row l="DATE" r={new Date(r.startedAt).toLocaleString()} />
          <Row l="AGENT" r={r.agent === 'claude' ? 'CLAUDE' : r.agent === 'compromised' ? 'COMPROMISED (SIM)' : 'AUTOPILOT'} />
          <Row l="DURATION" r={`${((r.endedAt - r.startedAt) / 1000).toFixed(1)}s`} />
          <div className="mt-2 text-[10.5px] text-[#444]">“{r.prompt.length > 90 ? r.prompt.slice(0, 88) + '…' : r.prompt}”</div>
          <div className="my-3 border-t border-dashed border-[#999]" />
          <div className="font-bold">CALLS ({r.calls.length})</div>
          {r.calls.map((c, i) => (
            <Row key={i} l={`${c.tool} → ${recipientName(snap, c.recipientId)}`} r={c.verdict.toUpperCase()} cls={c.verdict === 'blocked' ? 'text-[#b4233c]' : ''} />
          ))}
          <div className="my-3 border-t border-dashed border-[#999]" />
          <div className="font-bold">DISCLOSED ({r.shared.length})</div>
          {r.shared.length === 0 && <div className="text-[#666]">nothing</div>}
          {r.shared.map((s, i) => (
            <Row key={i} l={`${s.label} → ${recipientName(snap, s.recipientId)}`} r={s.form === 'exact' ? 'EXACT' : s.form.replace(/ \(.*\)$/, '').slice(0, 22)} />
          ))}
          <div className="my-3 border-t border-dashed border-[#999]" />
          <div className="font-bold">WITHHELD ({r.withheld.length})</div>
          {r.withheld.length === 0 && <div className="text-[#666]">nothing</div>}
          {r.withheld.map((s, i) => (
            <Row key={i} l={`${s.label}`} r={`✗ ${recipientName(snap, s.recipientId)}`} cls="text-[#b4233c]" />
          ))}
          {r.threats.length > 0 && (
            <>
              <div className="my-3 border-t border-dashed border-[#999]" />
              <div className="font-bold text-[#b4233c]">THREATS QUARANTINED ({r.threats.length})</div>
              {r.threats.map((t, i) => (
                <Row key={i} l={t.kind} r={`${t.severity.toUpperCase()} · ${recipientName(snap, t.recipientId)}`} />
              ))}
            </>
          )}
          <div className="my-3 border-t border-dashed border-[#999]" />
          <Row l="CATEGORIES EXPOSED" r={String(new Set(r.shared.filter((s) => s.form === 'exact').map((s) => CATEGORIES[s.category]?.group)).size)} />
          <Row l="LEDGER" r={`#${r.ledgerFrom}–#${r.ledgerTo}`} />
          <div className="mt-2 break-all text-[9.5px] text-[#555]">HEAD {r.headHash}</div>
          <div className="mt-3">
            <Barcode hash={r.headHash} />
          </div>
          <div className="mt-3 text-center text-[11px] font-bold">
            {verified === null ? 'VERIFYING CHAIN…' : verified ? '✓ HASH CHAIN VERIFIED' : '✗ CHAIN BROKEN — TAMPERING DETECTED'}
          </div>
          <div className="mt-1 text-center text-[9.5px] text-[#666]">Your data. Your rules. Your receipt.</div>
        </div>
      )}
    </Modal>
  );
}
