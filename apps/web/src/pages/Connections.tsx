import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Check, Copy, Plug, RefreshCw, Terminal } from 'lucide-react';
import { TIERS, type Tier } from '@consentry/core';
import { useApp } from '../lib/store';
import type { HealthMap } from '../lib/client';
import { PageHeader, Spinner, TierBadge, Toggle } from '../components/ui';

const TIER_ORDER: Tier[] = ['llm', 'public-sector', 'open-data', 'partner', 'unknown'];

function CopyBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] text-ink-400">
        <span className="flex items-center gap-1.5">
          <Terminal size={12} /> {label}
        </span>
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto scroll-thin p-3 font-mono text-[11.5px] leading-relaxed text-ink-200">{code}</pre>
    </div>
  );
}

export default function Connections() {
  const snap = useApp((s) => s.snap);
  const client = useApp((s) => s.client);
  const [health, setHealth] = useState<HealthMap | null>(null);
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    setHealth(await client!.health());
    setChecking(false);
  };
  useEffect(() => {
    if (client) void check();
  }, [client]); // eslint-disable-line react-hooks/exhaustive-deps

  const tools = snap?.tools ?? [];
  const recipients = snap?.recipients ?? [];
  const origin = typeof location !== 'undefined' ? location.origin : 'http://localhost:8787';

  return (
    <div>
      <PageHeader
        title="Connections"
        icon={<Plug size={20} />}
        subtitle={`${recipients.length - 1} verified recipients · ${tools.length} tools · anything else is default-deny`}
        actions={
          <button className="btn btn-ghost" onClick={check} disabled={checking}>
            {checking ? <Spinner /> : <RefreshCw size={15} />} Check live APIs
          </button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-7">
          {TIER_ORDER.map((tier) => {
            const rs = recipients.filter((r) => r.tier === tier);
            if (!rs.length) return null;
            return (
              <section key={tier}>
                <div className="mb-2 flex items-baseline gap-3">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-300">{TIERS[tier].label}</h2>
                  <span className="text-[11.5px] text-ink-500">{TIERS[tier].description}</span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {rs.map((r) => {
                    const h = health?.[r.id];
                    const rtools = tools.filter((t) => t.recipientId === r.id || (r.id === 'unknown' && t.recipientId === 'dynamic'));
                    return (
                      <div key={r.id} className="panel p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl">{r.emoji}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[14px] font-semibold text-white">{r.name}</span>
                              {r.simulated && <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">simulated</span>}
                              {h && (
                                <span className={clsx('flex items-center gap-1 text-[10.5px] font-medium', h.ok ? 'text-emerald-300' : 'text-rose-300')}>
                                  <span className={clsx('h-1.5 w-1.5 rounded-full', h.ok ? 'bg-emerald-400' : 'bg-rose-400')} /> {h.ok ? `live · ${h.ms}ms` : 'unreachable'}
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-ink-400">{r.domain === '*' ? 'any unverified domain' : r.domain}</div>
                            <div className="mt-1 text-[12px] text-ink-300">{r.description}</div>
                            {r.retention && <div className="mt-0.5 text-[11px] text-ink-500">Retention: {r.retention}</div>}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-[11px] text-ink-400">Trust tier</span>
                          {r.id === 'unknown' || r.tier === 'llm' ? (
                            <TierBadge tier={r.tier} />
                          ) : (
                            <select className="input !w-auto !py-1 !text-[12px]" value={r.tier} onChange={(e) => void client?.setTier(r.id, e.target.value as Tier)}>
                              {(['public-sector', 'open-data', 'partner'] as Tier[]).map((t) => (
                                <option key={t} value={t}>
                                  {TIERS[t].label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        {rtools.length > 0 && (
                          <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
                            {rtools.map((t) => (
                              <div key={t.name} className="flex items-center gap-2">
                                <Toggle checked={t.enabled} onChange={(v) => void client?.toggleTool(t.name, v)} label={`Enable ${t.title}`} />
                                <span className="text-[12.5px] text-ink-100">{t.title}</span>
                                <span className="truncate font-mono text-[10.5px] text-ink-500">{t.name}</span>
                                {t.calls > 0 && <span className="ml-auto shrink-0 text-[10.5px] text-mint">{t.calls} call{t.calls > 1 ? 's' : ''}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="panel ring-gradient p-5" data-demo="mcp">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mint">Protect any agent</div>
            <h3 className="mt-1 font-display text-lg font-bold text-white">Consentry is an MCP server</h3>
            <p className="mt-1 text-[12.5px] text-ink-300">Point Claude Desktop, Claude Code, Cursor or any MCP client at Consentry. Every tool call goes through this firewall, and consent prompts show up here.</p>
            <div className="mt-3 space-y-3">
              <CopyBlock
                label="claude_desktop_config.json"
                code={JSON.stringify({ mcpServers: { consentry: { command: 'npx', args: ['tsx', '/path/to/consentry/apps/mcp/src/index.ts'], env: { CONSENTRY_URL: 'http://localhost:8787' } } } }, null, 2)}
              />
              <CopyBlock label="Claude Code" code={`claude mcp add consentry -- npx tsx ./apps/mcp/src/index.ts`} />
              <CopyBlock
                label="Any agent · HTTP gateway"
                code={`curl -s ${snap?.mode === 'server' ? origin : 'http://localhost:8787'}/api/gateway/call \\
  -H 'content-type: application/json' \\
  -d '{"tool":"air_quality","agent":"my-bot",
       "args":{"location":"{{vault:home_location}}"}}'`}
              />
            </div>
            {snap?.mode === 'local' && <p className="mt-3 text-[11.5px] text-amber-300/80">You're in local-first mode (no server). Run <span className="font-mono">pnpm start</span> to enable the gateway and MCP bridge.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
