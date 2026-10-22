import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Pencil, Plus, Trash2, Vault as VaultIcon } from 'lucide-react';
import { CATEGORIES, type CategoryId, type MaskedVaultItem } from '@consentry/core';
import { useApp } from '../lib/store';
import { CategoryIcon, Modal, PageHeader, timeAgo } from '../components/ui';

const GROUP_ORDER = ['Identity', 'Contact', 'Location', 'Health', 'Financial', 'Vehicle', 'Secrets'];

function Sensitivity({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5" title={`Sensitivity ${n}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="h-1.5 w-3 rounded-full" style={{ background: i <= n ? (n >= 5 ? '#fb7185' : n >= 4 ? '#fbbf24' : '#8ea6bd') : 'rgba(255,240,225,0.08)' }} />
      ))}
    </div>
  );
}

function ItemCard({ item, onEdit }: { item: MaskedVaultItem; onEdit: (i: MaskedVaultItem, value: string) => void }) {
  const client = useApp((s) => s.client);
  const [revealed, setRevealed] = useState<string | null>(null);
  const toggle = async () => {
    if (revealed) return setRevealed(null);
    setRevealed((await client?.revealVault(item.id)) ?? null);
  };
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel group p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10" style={{ background: CATEGORIES[item.category].color + '14' }}>
          <CategoryIcon category={item.category} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-white">{item.label}</div>
            <Sensitivity n={item.sensitivity} />
          </div>
          <div className="mt-0.5 text-[11px] text-ink-400">
            {CATEGORIES[item.category].label} · <span className="font-mono">{`{{vault:${item.key}}}`}</span>
          </div>
        </div>
        <div className="flex gap-1 opacity-70 transition group-hover:opacity-100">
          <button onClick={toggle} className="rounded-lg p-1.5 text-ink-300 hover:bg-white/10 hover:text-white" aria-label={revealed ? 'Hide' : 'Reveal'}>
            {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button
            onClick={async () => onEdit(item, (await client?.revealVault(item.id)) ?? '')}
            className="rounded-lg p-1.5 text-ink-300 hover:bg-white/10 hover:text-white"
            aria-label="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete "${item.label}" from your vault?`)) void client?.deleteVault(item.id);
            }}
            className="rounded-lg p-1.5 text-ink-300 hover:bg-rose-500/15 hover:text-rose-300"
            aria-label="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2 font-mono text-[12.5px]">
        <motion.span key={revealed ? 'r' : 'm'} initial={{ opacity: 0, filter: 'blur(4px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} className={revealed ? 'text-white' : 'text-ink-300'}>
          {revealed ?? item.masked}
        </motion.span>
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11px]">
        <span className={item.flows ? 'text-amber-300/90' : 'text-emerald-300/80'}>{item.flows ? `Left the vault ${item.flows}× (exact or minimized)` : 'Never left the vault'}</span>
        {item.lastSharedAt && <span className="text-ink-500">{timeAgo(item.lastSharedAt)}</span>}
      </div>
    </motion.div>
  );
}

function Editor({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: { item?: MaskedVaultItem; value: string } }) {
  const client = useApp((s) => s.client);
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<CategoryId>('identity.name');
  const [value, setValue] = useState('');
  const [keywords, setKeywords] = useState('');
  const [busy, setBusy] = useState(false);
  const key = `${initial?.item?.id ?? 'new'}-${open}`;
  useEffect(() => {
    setLabel(initial?.item?.label ?? '');
    setCategory(initial?.item?.category ?? 'identity.name');
    setValue(initial?.value ?? '');
    setKeywords((initial?.item?.keywords ?? []).join(', '));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!label.trim() || !value.trim()) return;
    setBusy(true);
    await client?.upsertVault({ id: initial?.item?.id, key: initial?.item?.key, label: label.trim(), category, value: value.trim(), keywords: keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean), meta: initial?.item?.meta, sensitivity: initial?.item?.sensitivity });
    setBusy(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        <h2 className="font-display text-xl font-bold text-white">{initial?.item ? 'Edit vault item' : 'Add to vault'}</h2>
        <p className="mt-1 text-sm text-ink-400">Values are encrypted at rest (AES-256-GCM). Agents only ever see the token.</p>
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-300">Label</span>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Work email" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-300">Data type</span>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
              {Object.values(CATEGORIES)
                .filter((c) => c.id !== 'inferred.health' && c.id !== 'location.coarse')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.group} · {c.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-300">Value</span>
            <input className="input font-mono" value={value} onChange={(e) => setValue(e.target.value)} placeholder="The real value — stays in the vault" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-300">Also recognise these words (optional)</span>
            <input className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="brand names, nicknames… comma separated" />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || !label.trim() || !value.trim()} onClick={save}>
            <Lock size={14} /> {initial?.item ? 'Save' : 'Encrypt & add'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Vault() {
  const snap = useApp((s) => s.snap);
  const [editing, setEditing] = useState<{ item?: MaskedVaultItem; value: string } | null>(null);
  const groups = useMemo(() => {
    const m = new Map<string, MaskedVaultItem[]>();
    for (const v of snap?.vault ?? []) {
      const g = CATEGORIES[v.category].group;
      m.set(g, [...(m.get(g) ?? []), v]);
    }
    return GROUP_ORDER.filter((g) => m.has(g)).map((g) => [g, m.get(g)!] as const);
  }, [snap?.vault]);
  const never = (snap?.vault ?? []).filter((v) => !v.flows).length;

  return (
    <div>
      <PageHeader
        title="Vault"
        icon={<VaultIcon size={20} />}
        subtitle={
          <>
            {snap?.vault.length ?? 0} items · encrypted at rest with AES-256-GCM · <span className="text-emerald-300">{never} never left the vault</span>
          </>
        }
        actions={
          <button className="btn btn-primary" onClick={() => setEditing({ value: '' })}>
            <Plus size={15} /> Add item
          </button>
        }
      />
      <div className="panel mb-6 flex flex-wrap items-center gap-4 p-4 text-[12.5px] text-ink-300" data-demo="vault-banner">
        <Lock size={18} className="text-mint" />
        <div className="min-w-0 flex-1">
          Your agent never sees these values. It uses tokens like <span className="rounded bg-violet-400/15 px-1.5 py-0.5 font-mono text-violet-200">{'{{vault:home_location}}'}</span>, and Consentry resolves each token at the network boundary only if your policy allows that recipient, purpose and form.
        </div>
      </div>
      <div className="space-y-8">
        {groups.map(([g, items]) => (
          <section key={g}>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-400">{g}</h2>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {items.map((it) => (
                <ItemCard key={it.id} item={it} onEdit={(item, value) => setEditing({ item, value })} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <Editor open={!!editing} onClose={() => setEditing(null)} initial={editing ?? undefined} />
    </div>
  );
}
