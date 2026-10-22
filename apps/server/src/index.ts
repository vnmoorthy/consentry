import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConsentryRuntime, REDTEAM_CATALOG, type RuntimeEvent } from '@consentry/core';
import { SqliteStore } from './store';

process.removeAllListeners('warning'); // node:sqlite prints an ExperimentalWarning on some Node versions

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');

// Minimal .env loader (no dependency): KEY=value lines at the repo root.
const envPath = join(root, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = Number(process.env.PORT ?? 8787);
const dataDir = process.env.CONSENTRY_DATA_DIR ?? join(root, '.consentry');

const rt = await ConsentryRuntime.create({
  store: new SqliteStore(dataDir),
  mode: 'server',
  envApiKey: process.env.ANTHROPIC_API_KEY || undefined,
  envModel: process.env.CONSENTRY_MODEL || undefined,
  envEffort: (process.env.CONSENTRY_EFFORT as any) || undefined,
  envAgent: (process.env.CONSENTRY_AGENT as any) || undefined,
});

const app = new Hono();
app.use('/api/*', cors());
app.onError((err, c) => c.json({ error: err.message ?? String(err) }, 400));

const body = async (c: Context) => {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
};

app.get('/api/health', (c) => c.json({ ok: true, mode: 'server', version: '1.0.0', ledger: rt.ledger.entries.length }));
app.get('/api/state', (c) => c.json(rt.snapshot()));
app.get('/api/recent-events', (c) => c.json(rt.recentEvents.slice(-150)));

app.get('/api/events', (c) =>
  streamSSE(c, async (stream) => {
    const queue: RuntimeEvent[] = [];
    let wake: (() => void) | null = null;
    const off = rt.on((e) => {
      queue.push(e);
      wake?.();
    });
    stream.onAbort(() => {
      off();
      wake?.();
    });
    await stream.writeSSE({ event: 'hello', data: JSON.stringify({ ts: Date.now() }) });
    let lastPing = Date.now();
    while (!stream.aborted) {
      if (!queue.length) {
        await new Promise<void>((r) => {
          wake = r;
          setTimeout(r, 15000);
        });
        wake = null;
      }
      while (queue.length) await stream.writeSSE({ event: 'event', data: JSON.stringify(queue.shift()) });
      if (Date.now() - lastPing > 14000) {
        await stream.writeSSE({ event: 'ping', data: String(Date.now()) });
        lastPing = Date.now();
      }
    }
    off();
  }),
);

// Agent
app.post('/api/chat', async (c) => {
  const { message } = await body(c);
  if (!message || typeof message !== 'string') return c.json({ error: 'message required' }, 400);
  const { runId, done } = rt.startRun(message.slice(0, 4000));
  done.catch((e) => console.error('run failed', e));
  return c.json({ runId });
});
app.post('/api/chat/clear', (c) => (rt.clearChat(), c.json({ ok: true })));
app.post('/api/consent/:id', async (c) => {
  const { decision } = await body(c);
  if (!['allow_once', 'allow_always', 'minimize', 'deny'].includes(decision)) return c.json({ error: 'bad decision' }, 400);
  return c.json({ ok: rt.resolveConsent(c.req.param('id'), decision) });
});

// Vault
app.get('/api/vault/:id/reveal', (c) => c.json({ value: rt.revealVault(c.req.param('id')) ?? null }));
app.post('/api/vault', async (c) => c.json(rt.upsertVault(await body(c))));
app.delete('/api/vault/:id', (c) => (rt.deleteVault(c.req.param('id')), c.json({ ok: true })));

// Policies
app.post('/api/policies', async (c) => c.json(rt.upsertPolicy(await body(c))));
app.post('/api/policies/compile', async (c) => c.json(rt.compilePolicy(String((await body(c)).text ?? ''))));
app.post('/api/policies/simulate', async (c) => c.json(rt.simulate(await body(c))));
app.post('/api/policies/:id/toggle', async (c) => (rt.togglePolicy(c.req.param('id'), !!(await body(c)).enabled), c.json({ ok: true })));
app.delete('/api/policies/:id', (c) => (rt.deletePolicy(c.req.param('id')), c.json({ ok: true })));

// Ledger
app.get('/api/ledger', (c) => c.json(rt.listLedger(Number(c.req.query('limit') ?? 300))));
app.post('/api/ledger/verify', async (c) => c.json(await rt.verifyLedger()));
app.post('/api/ledger/tamper', async (c) => c.json({ entry: await rt.tamperLedger() }));
app.post('/api/ledger/repair', async (c) => c.json(await rt.repairLedger()));
app.get('/api/ledger/export', (c) => {
  c.header('Content-Disposition', `attachment; filename="consentry-ledger-${new Date().toISOString().slice(0, 10)}.json"`);
  return c.json(rt.exportLedger());
});

// Connections
app.post('/api/tools/:name/toggle', async (c) => (rt.toggleTool(c.req.param('name'), !!(await body(c)).enabled), c.json({ ok: true })));
app.post('/api/recipients/:id/tier', async (c) => (rt.setRecipientTier(c.req.param('id'), (await body(c)).tier), c.json({ ok: true })));
app.get('/api/health/apis', async (c) => c.json(await rt.health()));

// Red team
app.get('/api/redteam', (c) => c.json(REDTEAM_CATALOG));
app.post('/api/redteam/:id', async (c) => c.json(await rt.runRedTeam(c.req.param('id'))));

// Settings
app.put('/api/settings', async (c) => c.json(rt.updateSettings(await body(c))));
app.post('/api/reset', async (c) => (await rt.reset(), c.json({ ok: true })));

// Gateway: any agent (MCP clients, LangChain, curl…) can route tool calls through the firewall.
app.get('/api/gateway/tools', (c) => c.json(rt.listTools()));
app.post('/api/gateway/call', async (c) => {
  const { tool, args, agent } = await body(c);
  return c.json(await rt.gatewayCall(String(tool), args ?? {}, agent ? String(agent) : undefined));
});

// Dashboard (production build)
const webDist = join(root, 'apps/web/dist');
if (existsSync(webDist)) {
  const rel = relative(process.cwd(), webDist) || '.';
  app.use('/*', serveStatic({ root: rel }));
  app.get('*', (c) => c.html(readFileSync(join(webDist, 'index.html'), 'utf8')));
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  const mode = rt.settings.agentMode === 'claude' ? `Claude (${rt.settings.model})` : 'Autopilot (on-device, no LLM)';
  console.log(`\n  🛡️  Consentry gateway  →  http://localhost:${info.port}`);
  console.log(`     agent: ${mode} · ledger: ${rt.ledger.entries.length} entries · data: ${dataDir}\n`);
});

const shutdown = async () => {
  await rt.persistNow();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
