import { AnimatePresence, motion } from 'framer-motion';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Bot, Cpu, Footprints, KeyRound, Laptop, Menu, Plug, Radar, ScrollText, Server, Settings, ShieldCheck, Skull, Vault, X } from 'lucide-react';
import { useApp } from '../lib/store';
import { GithubIcon, Logo, ScoreRing } from './ui';
import { ConsentModal } from './ConsentModal';
import { ReceiptModal } from './ReceiptModal';
import { Welcome } from './Welcome';
import { DemoDirector } from './DemoDirector';

const NAV = [
  { to: '/', label: 'Command Center', icon: Radar },
  { to: '/footprint', label: 'Footprint', icon: Footprints },
  { to: '/vault', label: 'Vault', icon: Vault },
  { to: '/policies', label: 'Policies', icon: KeyRound },
  { to: '/ledger', label: 'Ledger', icon: ScrollText },
  { to: '/connections', label: 'Connections', icon: Plug },
  { to: '/redteam', label: 'Red Team', icon: Skull },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const REPO_URL = 'https://github.com/vnmoorthy/consentry';

function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            onClick={() => dismiss(t.id)}
            className={clsx(
              'pointer-events-auto rounded-2xl border px-4 py-3 text-left shadow-2xl backdrop-blur-xl',
              t.tone === 'bad' ? 'border-rose-400/40 bg-rose-950/80' : t.tone === 'warn' ? 'border-amber-400/30 bg-amber-950/70' : t.tone === 'ok' ? 'border-emerald-400/30 bg-emerald-950/70' : 'border-white/10 bg-ink-850/90',
            )}
          >
            <div className="text-sm font-semibold text-white">{t.title}</div>
            {t.body && <div className="mt-0.5 text-xs text-ink-200">{t.body}</div>}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const snap = useApp((s) => s.snap);
  const status = useApp((s) => s.status);
  const consents = useApp((s) => s.consents);
  const pulse = useApp((s) => s.ledgerPulse);
  const s = snap?.settings;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <Logo size={36} />
        <div>
          <div className="wordmark text-[15px] text-white">Consentry</div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-400">Consent firewall</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ to, label, icon: I }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors', isActive ? 'bg-white/[0.07] text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white')
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-gradient-to-b from-mint to-violet" />}
                <I size={17} className={isActive ? 'text-mint' : 'text-ink-400 group-hover:text-ink-200'} />
                <span className="flex-1">{label}</span>
                {to === '/' && consents.length > 0 && <span className="rounded-full bg-sky-400 px-1.5 text-[10px] font-bold text-ink-950">{consents.length}</span>}
                {to === '/ledger' && snap && (
                  <motion.span key={pulse} initial={{ scale: 1.4, color: '#efa56f' }} animate={{ scale: 1, color: '#77736a' }} className="font-mono text-[10.5px]">
                    {snap.ledger.count}
                  </motion.span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot space-y-3 p-4">
        <div className="panel flex items-center gap-3 p-3">
          <ScoreRing value={snap?.privacyScore ?? 100} size={46} stroke={4} />
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-white">Privacy score</div>
            <div className="score-desc text-[10.5px] leading-snug text-ink-400">How little of your data left, weighted by sensitivity</div>
          </div>
        </div>
        <div className="panel space-y-2 p-3 text-[11.5px]">
          <div className="flex items-center gap-2">
            {snap?.mode === 'server' ? <Server size={13} className="text-mint" /> : <Laptop size={13} className="text-mint" />}
            <span className="text-ink-300">{snap?.mode === 'server' ? 'Gateway server' : 'Local-first (in this tab)'}</span>
            <span className={clsx('ml-auto h-2 w-2 rounded-full', status === 'live' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'animate-pulse bg-amber-400')} />
          </div>
          <div className="flex items-center gap-2">
            {s?.agentMode === 'claude' ? <Bot size={13} className="text-violet" /> : <Cpu size={13} className="text-violet" />}
            <span className="truncate text-ink-300">{s?.agentMode === 'claude' ? `Claude · ${s.model}` : 'Autopilot · on-device'}</span>
          </div>
          {s?.poisonPartners && (
            <div className="flex items-center gap-2 text-amber-300">
              <Skull size={13} /> Hostile partners ON
            </div>
          )}
          {s?.compromisedAgent && (
            <div className="flex items-center gap-2 text-rose-300">
              <Skull size={13} /> Compromised-agent sim ON
            </div>
          )}
        </div>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="sidebar-repo flex items-center gap-2 px-1 text-[11.5px] text-ink-400 hover:text-white">
          <GithubIcon size={14} /> vnmoorthy/consentry
        </a>
      </div>
    </div>
  );
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    setOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [loc.pathname]);
  return (
    <div className="relative z-10 flex h-full">
      <div className="horizon" aria-hidden />
      <aside className="hidden w-[248px] shrink-0 border-r border-white/[0.06] bg-ink-950/70 backdrop-blur-xl lg:block">
        <SidebarBody />
      </aside>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} className="absolute inset-y-0 left-0 w-[248px] border-r border-white/10 bg-ink-950">
              <button className="absolute right-3 top-6 text-ink-300" onClick={() => setOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
              <SidebarBody onNavigate={() => setOpen(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto scroll-thin">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.06] bg-ink-950/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="text-ink-200">
            <Menu size={20} />
          </button>
          <Logo size={26} glow={false} />
          <span className="font-display font-bold">Consentry</span>
          <ShieldCheck size={16} className="ml-auto text-mint" />
        </div>
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
      <ConsentModal />
      <ReceiptModal />
      <Toasts />
      <Welcome />
      <DemoDirector />
    </div>
  );
}
