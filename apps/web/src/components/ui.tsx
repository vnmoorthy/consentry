import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Briefcase, Brain, Cake, Car, CreditCard, Fingerprint, HeartPulse, KeyRound, LoaderCircle, Mail, Map, MapPin, Phone, Pill, ScanSearch,
  User, WheatOff, X, type LucideIcon,
} from 'lucide-react';
import type { CategoryId, Tier, Verdict, Action } from '@consentry/core';
import { CATEGORIES, TIERS } from '@consentry/core';
import { useEffect, useId, type ReactNode } from 'react';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  user: User, cake: Cake, fingerprint: Fingerprint, briefcase: Briefcase, mail: Mail, phone: Phone, 'map-pin': MapPin, map: Map,
  'heart-pulse': HeartPulse, pill: Pill, 'wheat-off': WheatOff, brain: Brain, 'credit-card': CreditCard, car: Car, 'scan-search': ScanSearch, 'key-round': KeyRound,
};

export function CategoryIcon({ category, className, size = 16 }: { category: CategoryId; className?: string; size?: number }) {
  const info = CATEGORIES[category];
  const I = CATEGORY_ICONS[info?.icon] ?? User;
  return <I size={size} className={className} style={{ color: info?.color }} />;
}

export function Logo({ size = 32, glow = true }: { size?: number; glow?: boolean }) {
  // Unique gradient id per instance: a duplicate id inside a hidden subtree would render the logo blank.
  const id = 'lg' + useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={glow ? 'drop-shadow-[0_0_18px_rgba(239,165,111,0.32)]' : ''}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6d8b4" />
          <stop offset="1" stopColor="#e07b39" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#141511" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" fill="none" stroke="rgba(255,255,255,0.08)" />
      <path d="M32 9 51 16v14c0 12.5-8.2 21.6-19 25-10.8-3.4-19-12.5-19-25V16Z" fill="none" stroke={`url(#${id})`} strokeWidth="4" strokeLinejoin="round" />
      <circle cx="32" cy="29" r="5" fill={`url(#${id})`} />
      <path d="M32 33v9" stroke={`url(#${id})`} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export const VERDICT_STYLE: Record<Verdict | 'quarantined', { label: string; cls: string; dot: string }> = {
  clean: { label: 'Clean', cls: 'bg-slate-400/10 text-slate-300 border-slate-400/20', dot: 'bg-slate-400' },
  allowed: { label: 'Allowed', cls: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25', dot: 'bg-emerald-400' },
  minimized: { label: 'Minimized', cls: 'bg-amber-400/10 text-amber-300 border-amber-400/25', dot: 'bg-amber-400' },
  consented: { label: 'Consented', cls: 'bg-sky-400/10 text-sky-300 border-sky-400/25', dot: 'bg-sky-400' },
  blocked: { label: 'Blocked', cls: 'bg-rose-500/10 text-rose-300 border-rose-400/30', dot: 'bg-rose-400' },
  quarantined: { label: 'Quarantined', cls: 'bg-rose-500/15 text-rose-200 border-rose-400/40', dot: 'bg-rose-400' },
};

export function VerdictPill({ verdict, className }: { verdict: Verdict | 'quarantined'; className?: string }) {
  const s = VERDICT_STYLE[verdict] ?? VERDICT_STYLE.clean;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', s.cls, className)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

export const ACTION_STYLE: Record<Action, { label: string; cls: string }> = {
  shared: { label: 'shared', cls: 'text-emerald-300 bg-emerald-400/10' },
  minimized: { label: 'minimized', cls: 'text-amber-300 bg-amber-400/10' },
  tokenized: { label: 'tokenized', cls: 'text-violet-300 bg-violet-400/10' },
  withheld: { label: 'withheld', cls: 'text-rose-300 bg-rose-400/10' },
};

export function ActionTag({ action }: { action: Action }) {
  const s = ACTION_STYLE[action];
  return <span className={clsx('rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider', s.cls)}>{s.label}</span>;
}

export const EFFECT_STYLE: Record<string, string> = {
  allow: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25',
  minimize: 'text-amber-300 bg-amber-400/10 border-amber-400/25',
  ask: 'text-sky-300 bg-sky-400/10 border-sky-400/25',
  deny: 'text-rose-300 bg-rose-400/10 border-rose-400/25',
};

export function EffectPill({ effect, className }: { effect: string; className?: string }) {
  return <span className={clsx('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', EFFECT_STYLE[effect], className)}>{effect}</span>;
}

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  const t = TIERS[tier];
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-medium text-ink-200', className)} style={{ background: t.color + '14' }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
      {t.label}
    </span>
  );
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx('relative h-5 w-9 shrink-0 rounded-full border transition-colors', checked ? 'border-mint/50 bg-mint/30' : 'border-white/10 bg-white/5', disabled && 'cursor-not-allowed opacity-50')}
    >
      <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} className={clsx('absolute top-0.5 h-3.5 w-3.5 rounded-full', checked ? 'left-[18px] bg-mint' : 'left-0.5 bg-ink-300')} />
    </button>
  );
}

export function Modal({ open, onClose, children, wide, className }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean; className?: string }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={clsx('relative max-h-[90vh] w-full overflow-y-auto scroll-thin rounded-3xl border border-white/10 bg-ink-900 shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg', className)}
          >
            <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-ink-300 hover:bg-white/10 hover:text-white" aria-label="Close">
              <X size={16} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return <LoaderCircle size={size} className={clsx('animate-spin', className)} />;
}

export function ScoreRing({ value, size = 56, stroke = 5, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = value >= 85 ? '#34d399' : value >= 65 ? '#fbbf24' : '#fb7185';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,240,225,0.08)" strokeWidth={stroke} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1.2, ease: 'easeOut' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-sm font-bold leading-none" style={{ color }}>{value}</span>
        {label && <span className="mt-0.5 text-[8px] uppercase tracking-wider text-ink-400">{label}</span>}
      </div>
    </div>
  );
}

export function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Consentry never loads remote images in chat — a classic zero-click exfiltration channel.
          img: () => <span className="rounded bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] text-rose-300">[remote image blocked]</span>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export function PageHeader({ title, subtitle, icon, actions }: { title: string; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-mint">{icon}</div>}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-300">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, tone = 'default', icon, hint }: { label: string; value: ReactNode; tone?: 'default' | 'ok' | 'warn' | 'bad' | 'ask' | 'violet'; icon?: ReactNode; hint?: string }) {
  const toneCls = { default: 'text-white', ok: 'text-emerald-300', warn: 'text-amber-300', bad: 'text-rose-300', ask: 'text-sky-300', violet: 'text-violet-300' }[tone];
  return (
    <div className="panel flex items-center gap-3 px-4 py-3" title={hint}>
      {icon && <div className="text-ink-400">{icon}</div>}
      <div className="min-w-0">
        <motion.div key={String(value)} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={clsx('font-display text-xl font-bold leading-none tabular-nums', toneCls)}>
          {value}
        </motion.div>
        <div className="mt-1 truncate text-[11px] font-medium uppercase tracking-wider text-ink-400">{label}</div>
      </div>
    </div>
  );
}

export function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
