import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ArrowRight, Clapperboard, Hand, Radar, ScrollText, ShieldCheck } from 'lucide-react';

const KEY = 'consentry:welcomed:v1';
const seen = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
};

const POINTS = [
  { icon: Radar, title: 'Real public data', body: 'Weather, air, NWS, USGS, NHTSA, openFDA, OpenFEMA, all live' },
  { icon: ShieldCheck, title: 'Field-level firewall', body: 'Share, minimize, withhold or ask, even for the LLM' },
  { icon: Hand, title: 'Consent in the flow', body: 'Exact vs. minimized, side by side, when it matters' },
  { icon: ScrollText, title: 'Proof', body: 'Hash-chained ledger, receipts, deletion requests' },
];

export function openTour() {
  window.dispatchEvent(new CustomEvent('consentry:tour'));
}

export function Welcome() {
  const [open, setOpen] = useState(() => !seen());
  const close = (tour = false) => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
    if (tour) setTimeout(openTour, 450);
  };
  // The product video ends on the splash (scripts/video/record.ts).
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener('consentry:welcome', h);
    return () => window.removeEventListener('consentry:welcome', h);
  }, []);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] overflow-y-auto bg-ink-950" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }}>
          {/* horizon + sunrise */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #121310 0%, #191a1c 60%, #0e0f0c 100%)' }} />
            <motion.div className="absolute left-0 right-0 top-[58%] h-px origin-center" initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ duration: 1.8, ease: [0.2, 0.7, 0.2, 1] }} style={{ background: 'linear-gradient(90deg, transparent, rgba(142,166,189,0.35) 15%, rgba(247,217,185,0.35) 55%, rgba(255,232,206,0.85) 82%, transparent)' }} />
            <motion.div
              className="absolute top-[58%] h-[520px] w-[900px] -translate-y-1/2 rounded-full"
              initial={{ opacity: 0, left: '70%', scale: 0.7 }}
              animate={{ opacity: 1, left: ['70%', '58%'], scale: [0.7, 1.05] }}
              transition={{ duration: 6, ease: 'easeOut' }}
              style={{ background: 'radial-gradient(closest-side, rgba(247,217,185,0.28), rgba(239,165,111,0.12) 45%, transparent 75%)', filter: 'blur(8px)' }}
            />
            <motion.div className="absolute top-[58%] h-[3px] w-[260px] -translate-y-1/2 rounded-full" initial={{ opacity: 0, left: '78%' }} animate={{ opacity: [0, 1, 0.85], left: ['78%', '66%'] }} transition={{ duration: 6, ease: 'easeOut' }} style={{ background: 'radial-gradient(closest-side, rgba(255,240,222,0.95), transparent)', filter: 'blur(1px)' }} />
            <div className="absolute inset-y-0 left-0 w-1/3" style={{ background: 'radial-gradient(600px 240px at 0% 58%, rgba(142,166,189,0.12), transparent 70%)' }} />
          </div>

          <div className="relative flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
            <motion.div initial={{ opacity: 0, letterSpacing: '0.12em' }} animate={{ opacity: 1, letterSpacing: '0.34em' }} transition={{ duration: 2.2, ease: [0.2, 0.7, 0.2, 1] }} className="wordmark pl-[0.34em] text-[clamp(40px,7.5vw,104px)] font-medium leading-none text-white">
              Consentry
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.8 }} className="mt-6 text-[11px] font-medium uppercase tracking-[0.42em] text-mint">
              The consent firewall for AI agents
            </motion.div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 0.9 }} className="mt-[22vh] max-w-xl text-[17px] font-light leading-relaxed text-ink-200 sm:mt-[18vh]">
              Your agent can use the world&apos;s public data. <span className="text-white">The world can&apos;t use yours.</span>
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6, duration: 0.7 }} className="mt-8 grid w-full max-w-4xl grid-cols-2 gap-3 text-left md:grid-cols-4">
              {POINTS.map((p) => (
                <div key={p.title} className="rounded-2xl border border-white/[0.08] bg-ink-900/60 p-4 backdrop-blur">
                  <p.icon size={16} className="text-mint" />
                  <div className="mt-2 text-[13px] font-medium text-white">{p.title}</div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-ink-400">{p.body}</div>
                </div>
              ))}
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 0.6 }} className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button className="btn btn-primary px-6 py-3 text-[14px]" onClick={() => close(true)}>
                <Clapperboard size={16} /> Start the guided tour
              </button>
              <button className="btn btn-ghost px-6 py-3 text-[14px]" onClick={() => close(false)}>
                Explore on my own <ArrowRight size={16} />
              </button>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.3 }} className="mt-6 text-[11px] tracking-wide text-ink-500">
              You&apos;re signed in as Maya Rivera, a fictional persona with asthma, a peanut allergy and a 2003 Honda Accord. Partners are simulated; public APIs are real.
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
