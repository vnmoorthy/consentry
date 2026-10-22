import { motion } from 'framer-motion';
import { useState } from 'react';
import { ArrowRight, Hand, Radar, ScrollText, ShieldCheck } from 'lucide-react';
import { Logo, Modal } from './ui';

const KEY = 'consentry:welcomed:v1';
const seen = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
};

const STEPS = [
  { icon: Radar, title: 'Your agent uses real public data', body: 'Weather, air quality, NWS alerts, USGS quakes, NHTSA recalls, openFDA and OpenFEMA, all live. Partners like TableTap and RideNow are simulated so the demo is safe.' },
  { icon: ShieldCheck, title: 'Every byte crosses the firewall', body: 'Consentry finds your personal data in each request and then shares it, minimizes it, withholds it, or asks you. That covers the LLM too: it only ever sees vault tokens.' },
  { icon: Hand, title: 'Consent that actually means something', body: 'Write rules in plain English. When a partner wants your allergy or home address, you get a clear prompt with an exact vs. minimized preview.' },
  { icon: ScrollText, title: 'Proof, not promises', body: 'Every decision lands in a SHA-256 hash-chained ledger with a privacy receipt. Try rewriting history on the Red Team page and watch it get caught.' },
];

export function Welcome() {
  const [open, setOpen] = useState(() => !seen());
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };
  return (
    <Modal open={open} onClose={close} wide>
      <div className="relative overflow-hidden p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-mint/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet/10 blur-3xl" />
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mint">Welcome to Consentry</div>
        </div>
        <h2 className="mt-5 font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
          Your agent can use the world&apos;s data.
          <br />
          <span className="text-gradient">The world can&apos;t use yours.</span>
        </h2>
        <p className="mt-3 max-w-xl text-sm text-ink-300">
          Consentry is a consent firewall that sits between your AI agent and everything it talks to. You&apos;re signed in as <span className="font-semibold text-white">Maya</span>, a demo persona with asthma, a peanut allergy, a 2003 Honda and the usual pile of personal data.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
              <s.icon size={18} className="text-mint" />
              <div className="mt-2 text-sm font-semibold text-white">{s.title}</div>
              <div className="mt-1 text-xs leading-relaxed text-ink-300">{s.body}</div>
            </motion.div>
          ))}
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button className="btn btn-primary px-5 py-3 text-sm" onClick={close}>
            Start the demo <ArrowRight size={16} />
          </button>
          <span className="text-xs text-ink-400">Tip: try the scenario chips above the chat box.</span>
        </div>
      </div>
    </Modal>
  );
}
