import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Bot, Cpu, KeyRound, Laptop, RotateCcw, Server, Settings as SettingsIcon, Skull } from 'lucide-react';
import { useApp } from '../lib/store';
import { PageHeader, Toggle } from '../components/ui';

const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Most capable (default)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'Fast & capable' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'Fastest, cheapest' },
];

export default function Settings() {
  const snap = useApp((s) => s.snap);
  const client = useApp((s) => s.client);
  const toast = useApp((s) => s.toast);
  const s = snap?.settings;
  const [key, setKey] = useState('');
  const [timeout, setTimeoutSec] = useState(180);
  useEffect(() => {
    if (s) setTimeoutSec(s.consentTimeoutSec);
  }, [s?.consentTimeoutSec]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = async (patch: any, msg?: string) => {
    await client?.updateSettings(patch);
    if (msg) toast({ tone: 'ok', title: msg });
  };

  if (!s) return null;
  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" icon={<SettingsIcon size={20} />} subtitle="Choose your agent's brain and how Consentry behaves." />
      <div className="space-y-5">
        <section className="panel p-5">
          <h2 className="font-display text-base font-bold text-white">Agent brain</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-400">Either way, every tool call goes through the same firewall.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button onClick={() => update({ agentMode: 'autopilot' }, 'Autopilot enabled')} className={clsx('rounded-2xl border p-4 text-left transition', s.agentMode === 'autopilot' ? 'border-mint/50 bg-mint/[0.07]' : 'border-white/10 hover:border-white/20')}>
              <Cpu size={20} className="text-mint" />
              <div className="mt-2 font-semibold text-white">Autopilot (on-device)</div>
              <div className="mt-1 text-[12px] text-ink-300">A deterministic planner that runs right here. No LLM sees anything; it reasons over your vault locally and calls only the tools it needs.</div>
            </button>
            <button
              onClick={() => (s.hasApiKey ? update({ agentMode: 'claude' }, 'Claude enabled') : toast({ tone: 'warn', title: 'Add an Anthropic API key first' }))}
              className={clsx('rounded-2xl border p-4 text-left transition', s.agentMode === 'claude' ? 'border-violet/50 bg-violet/[0.07]' : 'border-white/10 hover:border-white/20')}
            >
              <Bot size={20} className="text-violet" />
              <div className="mt-2 font-semibold text-white">Claude</div>
              <div className="mt-1 text-[12px] text-ink-300">Claude plans and calls tools, but it only ever sees vault tokens. Prompts and tool results are tokenized before they reach the model.</div>
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_140px]">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-300">Anthropic API key {s.keySource && <span className="text-emerald-300">· configured ({s.keySource === 'env' ? 'from .env' : 'encrypted in vault store'})</span>}</label>
              <div className="flex gap-2">
                <input type="password" className="input font-mono" value={key} onChange={(e) => setKey(e.target.value)} placeholder={s.hasApiKey ? '•••••••••••• (saved)' : 'sk-ant-…'} autoComplete="off" />
                <button
                  className="btn btn-ghost"
                  disabled={!key.trim()}
                  onClick={async () => {
                    await update({ apiKey: key.trim(), agentMode: 'claude' }, 'Key saved. Claude enabled');
                    setKey('');
                  }}
                >
                  <KeyRound size={14} /> Save
                </button>
              </div>
              {s.keySource === 'user' && (
                <button className="mt-1.5 text-[11.5px] text-rose-300 hover:underline" onClick={() => update({ apiKey: '', agentMode: 'autopilot' }, 'Key removed')}>
                  Remove saved key
                </button>
              )}
              <p className="mt-1.5 text-[11px] text-ink-500">{snap.mode === 'local' ? 'Local-first mode: the key is encrypted in this browser and sent only to api.anthropic.com.' : 'Stored encrypted on your gateway (AES-256-GCM). Or set ANTHROPIC_API_KEY in .env.'}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-300">Model</label>
              <select className="input" value={s.model} onChange={(e) => update({ model: e.target.value })}>
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-300">Effort</label>
              <select className="input" value={s.effort} onChange={(e) => update({ effort: e.target.value })}>
                {['low', 'medium', 'high'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-base font-bold text-white">Behaviour</h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-4">
              <Toggle checked={s.compromisedAgent} onChange={(v) => update({ compromisedAgent: v }, v ? 'Compromised-agent simulation ON' : 'Simulation off')} label="Compromised agent" />
              <div>
                <div className="flex items-center gap-2 text-[13.5px] font-semibold text-white">
                  <Skull size={14} className="text-rose-300" /> Simulate a compromised agent
                </div>
                <div className="text-[12px] text-ink-400">The agent will obey any instruction it finds in tool output. This proves the firewall holds even when the model doesn&apos;t. Pair it with the poisoned-review attack.</div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Toggle checked={s.poisonPartners} onChange={(v) => update({ poisonPartners: v }, v ? 'Hostile partners ON: reviews carry prompt injections' : 'Partners are well-behaved again')} label="Hostile partners" />
              <div>
                <div className="flex items-center gap-2 text-[13.5px] font-semibold text-white">
                  <Skull size={14} className="text-amber-300" /> Hostile partners (live red team)
                </div>
                <div className="text-[12px] text-ink-400">BiteFinder reviews hide a prompt injection and TableTap confirmations smuggle an exfiltration image. Try “book dinner” with Claude as the brain and watch the quarantine fire.</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <input type="number" min={30} max={900} className="input !w-24" value={timeout} onChange={(e) => setTimeoutSec(Number(e.target.value))} onBlur={() => update({ consentTimeoutSec: Math.max(30, Math.min(900, timeout)) })} />
              <div>
                <div className="text-[13.5px] font-semibold text-white">Consent timeout (seconds)</div>
                <div className="text-[12px] text-ink-400">If you don&apos;t answer a consent prompt in time, Consentry denies.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-base font-bold text-white">Runtime</h2>
          <div className="mt-3 flex items-center gap-3 text-[13px] text-ink-200">
            {snap.mode === 'server' ? <Server size={16} className="text-mint" /> : <Laptop size={16} className="text-mint" />}
            {snap.mode === 'server' ? 'Connected to the Consentry gateway server (SQLite ledger, encrypted vault, MCP bridge).' : 'Local-first: the entire firewall runs inside this browser tab. Run `pnpm start` for the gateway.'}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn btn-danger"
              onClick={async () => {
                if (!confirm('Reset vault, policies, ledger and chat to the demo defaults?')) return;
                await client?.reset();
                location.reload();
              }}
            >
              <RotateCcw size={14} /> Reset demo data
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                try {
                  localStorage.removeItem('consentry:welcomed:v1');
                } catch {
                  /* ignore */
                }
                location.reload();
              }}
            >
              Show welcome screen
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
