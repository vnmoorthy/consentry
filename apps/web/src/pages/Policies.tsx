import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Clock, FlaskConical, KeyRound, Lock, Plus, Trash2, Wand2 } from 'lucide-react';
import { PURPOSES, describeRule, type CompiledPolicy, type PolicyRule, type Purpose } from '@consentry/core';
import { useApp } from '../lib/store';
import type { SimResult } from '../lib/client';
import { EffectPill, PageHeader, Spinner, Toggle } from '../components/ui';

const EXAMPLES = [
  'Never share my location with commercial apps',
  'Let TableTap see my phone number for reservations for 24 hours',
  'Ask me before any company gets my email',
  'Only share my approximate location with ride services',
  'Never let the AI see my medications',
];

function Countdown({ to }: { to: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, to - now);
  const d = Math.floor(ms / 86400e3);
  const h = Math.floor((ms % 86400e3) / 3600e3);
  const m = Math.floor((ms % 3600e3) / 60e3);
  return <span>{d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`} left</span>;
}

function RuleRow({ r }: { r: PolicyRule }) {
  const client = useApp((s) => s.client);
  const snap = useApp((s) => s.snap);
  const toast = useApp((s) => s.toast);
  const act = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e: any) {
      toast({ tone: 'bad', title: 'Not allowed', body: e.message });
    }
  };
  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={clsx('flex items-center gap-3 rounded-2xl border px-4 py-3 transition', r.enabled ? 'border-white/[0.07] bg-white/[0.025]' : 'border-white/[0.04] bg-transparent opacity-55')}>
      {r.hard ? (
        <div title="Hard line — can't be disabled or overridden" className="flex h-5 w-9 items-center justify-center">
          <Lock size={14} className="text-rose-300" />
        </div>
      ) : (
        <Toggle checked={r.enabled} onChange={(v) => act(() => client!.togglePolicy(r.id, v))} label="Enable rule" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium text-white">{r.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-400">
          <span className="font-mono">{describeRule(r, snap?.recipients ?? [])}</span>
          {r.transform && <span className="text-amber-300/80">· {r.transform}</span>}
          <span>· priority {r.priority}</span>
          {!!r.hits && <span className="text-mint/80">· {r.hits} hit{r.hits > 1 ? 's' : ''}</span>}
          {r.expiresAt && (
            <span className="flex items-center gap-1 text-sky-300/90">
              · <Clock size={10} /> <Countdown to={r.expiresAt} />
            </span>
          )}
        </div>
      </div>
      <EffectPill effect={r.effect} />
      {!r.hard && r.source !== 'default' && (
        <button onClick={() => act(() => client!.deletePolicy(r.id))} className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-500/15 hover:text-rose-300" aria-label={r.source === 'grant' ? 'Revoke' : 'Delete'} title={r.source === 'grant' ? 'Revoke grant' : 'Delete rule'}>
          <Trash2 size={15} />
        </button>
      )}
    </motion.div>
  );
}

function Composer() {
  const client = useApp((s) => s.client);
  const toast = useApp((s) => s.toast);
  const [text, setText] = useState('');
  const [compiled, setCompiled] = useState<CompiledPolicy | null>(null);
  const [busy, setBusy] = useState(false);
  const compile = async (t = text) => {
    if (!t.trim()) return;
    setBusy(true);
    setCompiled(await client!.compilePolicy(t));
    setBusy(false);
  };
  const add = async () => {
    if (!compiled) return;
    await client!.upsertPolicy(compiled.rule);
    toast({ tone: 'ok', title: 'Rule added', body: compiled.rule.title });
    setCompiled(null);
    setText('');
  };
  return (
    <div className="panel ring-gradient p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-mint">
        <Wand2 size={13} /> Write a rule in plain English
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="input text-[14px]"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCompiled(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && compile()}
          placeholder="e.g. Never share my health data with commercial apps"
        />
        <button className="btn btn-primary" onClick={() => compile()} disabled={busy || !text.trim()}>
          {busy ? <Spinner /> : <Wand2 size={15} />} Compile
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            onClick={() => {
              setText(e);
              void compile(e);
            }}
            className="rounded-full border border-white/10 px-2.5 py-1 text-[11.5px] text-ink-300 hover:border-mint/40 hover:text-white"
          >
            {e}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {compiled && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">{compiled.rule.title}</div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-400">confidence {(compiled.confidence * 100).toFixed(0)}%</span>
                  <EffectPill effect={compiled.rule.effect} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {compiled.understood.map((u) => (
                  <span key={u} className="rounded-lg bg-white/5 px-2 py-1 font-mono text-[11px] text-ink-200">{u}</span>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-[11px] text-ink-400">Priority {compiled.rule.priority}: your rules outrank defaults, but never the hard lines.</div>
                <button className="btn btn-primary" onClick={add}>
                  <Plus size={15} /> Add rule
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Simulator() {
  const snap = useApp((s) => s.snap);
  const client = useApp((s) => s.client);
  const [itemId, setItemId] = useState('v_home');
  const [recipientId, setRecipientId] = useState('tabletap');
  const [purpose, setPurpose] = useState<Purpose>('reservation');
  const [res, setRes] = useState<SimResult | null>(null);
  const policiesKey = useMemo(() => JSON.stringify(snap?.policies.map((p) => [p.id, p.enabled, p.expiresAt])), [snap?.policies]);
  useEffect(() => {
    if (!client) return;
    void client.simulate({ itemId, recipientId, purpose }).then(setRes);
  }, [client, itemId, recipientId, purpose, policiesKey]);
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet">
        <FlaskConical size={13} /> Policy simulator
      </div>
      <p className="mt-1 text-[12px] text-ink-400">What would happen if…</p>
      <div className="mt-3 grid gap-2">
        <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
          {snap?.vault.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
            {snap?.recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.emoji} {r.name}
              </option>
            ))}
          </select>
          <select className="input" value={purpose} onChange={(e) => setPurpose(e.target.value as Purpose)}>
            {Object.entries(PURPOSES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      {res && (
        <motion.div key={JSON.stringify(res.decision)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2">
            <EffectPill effect={res.decision.effect} />
            {res.decision.hard && (
              <span className="flex items-center gap-1 text-[11px] text-rose-300">
                <Lock size={11} /> hard line
              </span>
            )}
          </div>
          <div className="mt-2 text-[13px] text-white">{res.decision.reason}</div>
          {res.output && (
            <div className="mt-2 rounded-lg bg-white/5 px-2.5 py-1.5 font-mono text-[11.5px] text-amber-100">
              {res.recipient} receives → {res.output}
            </div>
          )}
          {res.matched.length > 1 && (
            <div className="mt-3">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-500">Also matched (lower priority)</div>
              {res.matched.slice(1, 4).map((m) => (
                <div key={m.id} className="mt-1 flex items-center gap-2 text-[11.5px] text-ink-400">
                  <span className="font-mono text-[10px]">{m.priority}</span> {m.title}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default function Policies() {
  const snap = useApp((s) => s.snap);
  const ps = snap?.policies ?? [];
  const sections: [string, string, PolicyRule[]][] = [
    ['Hard lines', 'Cannot be disabled, overridden by grants, or consented away.', ps.filter((p) => p.hard)],
    ['Your rules', 'Written by you in plain English.', ps.filter((p) => p.source === 'user')],
    ['Active grants', 'Created when you chose “30 days” on a consent prompt. Revoke any time.', ps.filter((p) => p.source === 'grant')],
    ['Defaults', 'Privacy-first defaults. Toggle anything you disagree with.', ps.filter((p) => p.source === 'default' && !p.hard)],
  ];
  return (
    <div>
      <PageHeader title="Policies" icon={<KeyRound size={20} />} subtitle={`${ps.filter((p) => p.enabled).length} active rules · evaluated per field, per recipient, per purpose`} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Composer />
          {sections.map(([title, desc, rules]) => (
            <section key={title}>
              <div className="mb-2 flex items-baseline gap-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-300">
                  {title} <span className="text-ink-500">({rules.length})</span>
                </h2>
                <span className="text-[11.5px] text-ink-500">{desc}</span>
              </div>
              {rules.length ? (
                <div className="space-y-2">
                  {rules.map((r) => (
                    <RuleRow key={r.id} r={r} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-[12px] text-ink-500">None yet.</div>
              )}
            </section>
          ))}
        </div>
        <div className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <Simulator />
          <div className="panel p-5 text-[12.5px] leading-relaxed text-ink-300">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-400">How decisions are made</div>
            <ol className="list-decimal space-y-1.5 pl-4">
              <li>Every field in a request is classified (vault fingerprint, token, pattern + checksum, health lexicon, geo-proximity).</li>
              <li>For each field, the highest-priority matching rule wins. Ties go to the more specific rule, then the more restrictive one.</li>
              <li><b className="text-white">allow</b> sends it, <b className="text-amber-300">minimize</b> transforms it, <b className="text-sky-300">ask</b> pauses the agent for you, <b className="text-rose-300">deny</b> withholds it.</li>
              <li>If a required field is withheld, the call never leaves. Everything is hash-chained in the ledger.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
