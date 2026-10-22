import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { CategoryId, Recipient } from '@consentry/core';
import { useApp, type Packet } from '../lib/store';

const W = 760;
const H = 430;
const SHIELD = { x: 380, y: H / 2 };
const LEFT_X = 92;
const RIGHT_X = 640;

const GROUPS = [
  { id: 'Identity', label: 'Identity', color: '#a78bfa' },
  { id: 'Contact', label: 'Contact', color: '#60a5fa' },
  { id: 'Location', label: 'Location', color: '#2dd4bf' },
  { id: 'Health', label: 'Health', color: '#fb7185' },
  { id: 'Money', label: 'Money', color: '#fbbf24' },
  { id: 'Vehicle', label: 'Vehicle', color: '#a3e635' },
  { id: 'Query', label: 'Public query', color: '#94a3b8' },
];

function groupOf(c: CategoryId | 'query'): string {
  if (c === 'query') return 'Query';
  if (c.startsWith('identity') || c.startsWith('secret')) return 'Identity';
  if (c.startsWith('contact')) return 'Contact';
  if (c.startsWith('location')) return 'Location';
  if (c.startsWith('health') || c.startsWith('inferred')) return 'Health';
  if (c.startsWith('financial')) return 'Money';
  return 'Vehicle';
}

const OUTCOME_COLOR: Record<Packet['outcome'], string> = {
  shared: '#34d399',
  minimized: '#fbbf24',
  tokenized: '#a78bfa',
  withheld: '#fb7185',
  blocked: '#fb7185',
  query: '#93c5fd',
  threat: '#f43f5e',
};

function bezier(p0: { x: number; y: number }, p3: { x: number; y: number }, n = 10) {
  const dx = (p3.x - p0.x) * 0.55;
  const p1 = { x: p0.x + dx, y: p0.y };
  const p2 = { x: p3.x - dx, y: p3.y };
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    xs.push(mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x);
    ys.push(mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y);
  }
  return { xs, ys, d: `M${p0.x},${p0.y} C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}` };
}

const ORDER = ['claude', 'open-meteo', 'nws', 'usgs', 'nhtsa', 'openfda', 'fema', 'wikipedia', 'bitefinder', 'tabletap', 'ridenow', 'medimart', 'quickquote', 'unknown'];

export function FlowMap({ compact = false }: { compact?: boolean }) {
  const snap = useApp((s) => s.snap);
  const packets = useApp((s) => s.packets);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const recipients: Recipient[] = useMemo(() => {
    const rs = snap?.recipients ?? [];
    return ORDER.map((id) => rs.find((r) => r.id === id)).filter(Boolean) as Recipient[];
  }, [snap?.recipients]);

  const leftY = (i: number) => 38 + i * ((H - 76) / (GROUPS.length - 1));
  const rightY = (i: number) => 22 + i * ((H - 44) / Math.max(1, recipients.length - 1));
  const leftPos = Object.fromEntries(GROUPS.map((g, i) => [g.id, { x: LEFT_X, y: leftY(i) }]));
  const rightPos = Object.fromEntries(recipients.map((r, i) => [r.id, { x: RIGHT_X, y: rightY(i) }]));

  const now = Date.now();
  const live = packets.filter((p) => now - p.ts < 5500);
  const hotLeft = new Set(live.map((p) => groupOf(p.category)));
  const hotRight = new Map<string, string>();
  for (const p of live) if (p.outcome !== 'withheld' && p.outcome !== 'blocked') hotRight.set(p.recipientId, OUTCOME_COLOR[p.outcome]);
  const anyBlocked = live.some((p) => p.outcome === 'withheld' || p.outcome === 'blocked' || p.outcome === 'threat');

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: compact ? 300 : 440 }}>
        <defs>
          <radialGradient id="shieldGlow">
            <stop offset="0" stopColor="#5eead4" stopOpacity="0.35" />
            <stop offset="1" stopColor="#5eead4" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="shieldGlowBad">
            <stop offset="0" stopColor="#fb7185" stopOpacity="0.45" />
            <stop offset="1" stopColor="#fb7185" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="shieldStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5eead4" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
          <filter id="blur4">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* wires */}
        {GROUPS.map((g) => (
          <path key={g.id} d={bezier({ x: LEFT_X + 16, y: leftPos[g.id].y }, SHIELD).d} stroke={hotLeft.has(g.id) ? g.color : 'rgba(255,255,255,0.07)'} strokeOpacity={hotLeft.has(g.id) ? 0.55 : 1} strokeWidth={hotLeft.has(g.id) ? 1.6 : 1} fill="none" style={{ transition: 'all .4s' }} />
        ))}
        {recipients.map((r) => (
          <path key={r.id} d={bezier(SHIELD, { x: RIGHT_X - 16, y: rightPos[r.id].y }).d} stroke={hotRight.get(r.id) ?? 'rgba(255,255,255,0.06)'} strokeOpacity={hotRight.has(r.id) ? 0.6 : 1} strokeWidth={hotRight.has(r.id) ? 1.6 : 1} strokeDasharray={r.tier === 'unknown' ? '3 4' : undefined} fill="none" style={{ transition: 'all .4s' }} />
        ))}

        {/* left nodes */}
        {GROUPS.map((g) => {
          const p = leftPos[g.id];
          const hot = hotLeft.has(g.id);
          return (
            <g key={g.id}>
              <circle cx={p.x + 16} cy={p.y} r={hot ? 6 : 4} fill={g.color} opacity={hot ? 1 : 0.45} style={{ transition: 'all .3s' }} />
              {hot && <circle cx={p.x + 16} cy={p.y} r={11} fill={g.color} opacity={0.18} filter="url(#blur4)" />}
              <text x={p.x} y={p.y + 4} textAnchor="end" fontSize="12" fontWeight={600} fill={hot ? '#fff' : '#8a93ad'} fontFamily="Inter" style={{ transition: 'fill .3s' }}>
                {g.label}
              </text>
            </g>
          );
        })}

        {/* right nodes */}
        {recipients.map((r) => {
          const p = rightPos[r.id];
          const hot = hotRight.get(r.id);
          return (
            <g key={r.id}>
              <circle cx={p.x - 16} cy={p.y} r={hot ? 5.5 : 3.5} fill={hot ?? (r.tier === 'unknown' ? '#fb7185' : '#5b6480')} opacity={hot ? 1 : 0.6} style={{ transition: 'all .3s' }} />
              <text x={p.x - 4} y={p.y + 4} fontSize="11" fontWeight={hot ? 650 : 500} fill={hot ? '#fff' : '#8a93ad'} fontFamily="Inter" style={{ transition: 'fill .3s' }}>
                {r.emoji} {r.name.replace(' (LLM)', '').replace(' Insurance', '').replace(' Pharmacy', '')}
                {r.simulated ? ' ·sim' : ''}
              </text>
            </g>
          );
        })}

        {/* shield */}
        <circle cx={SHIELD.x} cy={SHIELD.y} r={74} fill={`url(#${anyBlocked ? 'shieldGlowBad' : 'shieldGlow'})`} />
        <motion.circle cx={SHIELD.x} cy={SHIELD.y} r={46} fill="none" stroke="url(#shieldStroke)" strokeOpacity={0.25} strokeWidth={1} animate={{ r: [44, 54, 44], opacity: [0.6, 0.15, 0.6] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} />
        <circle cx={SHIELD.x} cy={SHIELD.y} r={38} fill="#0b0d14" stroke="url(#shieldStroke)" strokeWidth={1.5} />
        <g transform={`translate(${SHIELD.x - 17}, ${SHIELD.y - 20}) scale(0.53)`}>
          <path d="M32 9 51 16v14c0 12.5-8.2 21.6-19 25-10.8-3.4-19-12.5-19-25V16Z" fill="none" stroke="url(#shieldStroke)" strokeWidth="4.5" strokeLinejoin="round" />
          <circle cx="32" cy="29" r="5" fill="url(#shieldStroke)" />
          <path d="M32 33v9" stroke="url(#shieldStroke)" strokeWidth="4.5" strokeLinecap="round" />
        </g>
        <text x={SHIELD.x} y={SHIELD.y + 58} textAnchor="middle" fontSize="11" fontWeight={700} letterSpacing="2" fill="#5eead4" fontFamily="Inter Tight">
          CONSENTRY
        </text>

        {/* packets */}
        {live.map((p) => {
          const from = leftPos[groupOf(p.category)];
          const to = rightPos[p.recipientId] ?? rightPos['unknown'];
          if (!from || !to) return null;
          const color = OUTCOME_COLOR[p.outcome];
          if (p.outcome === 'threat') {
            const b = bezier({ x: to.x - 16, y: to.y }, SHIELD, 10);
            return (
              <g key={p.id}>
                <motion.circle r={5} fill={color} initial={{ cx: b.xs[0], cy: b.ys[0], opacity: 0 }} animate={{ cx: b.xs, cy: b.ys, opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0] }} transition={{ duration: 1.1, delay: p.delay, ease: 'easeIn' }} />
                <motion.circle cx={SHIELD.x} cy={SHIELD.y} fill="none" stroke={color} strokeWidth={3} initial={{ r: 30, opacity: 0 }} animate={{ r: [30, 70], opacity: [0.9, 0] }} transition={{ duration: 0.9, delay: p.delay + 1.05 }} />
              </g>
            );
          }
          const a = bezier({ x: from.x + 16, y: from.y }, SHIELD, 10);
          const stops = p.outcome === 'withheld' || p.outcome === 'blocked';
          if (stops) {
            return (
              <g key={p.id}>
                <motion.circle r={4.5} fill={color} initial={{ cx: a.xs[0], cy: a.ys[0], opacity: 0 }} animate={{ cx: a.xs, cy: a.ys, opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0] }} transition={{ duration: 0.9, delay: p.delay, ease: 'easeIn' }} />
                <motion.circle cx={SHIELD.x - 36} cy={SHIELD.y} fill="none" stroke={color} strokeWidth={2.5} initial={{ r: 3, opacity: 0 }} animate={{ r: [3, 22], opacity: [1, 0] }} transition={{ duration: 0.6, delay: p.delay + 0.85 }} />
              </g>
            );
          }
          const b = bezier(SHIELD, { x: to.x - 16, y: to.y }, 10);
          const xs = [...a.xs, ...b.xs.slice(1)];
          const ys = [...a.ys, ...b.ys.slice(1)];
          const op = xs.map((_, i) => (i === 0 || i === xs.length - 1 ? 0 : 1));
          const startColor = p.outcome === 'query' ? color : GROUPS.find((g) => g.id === groupOf(p.category))?.color ?? color;
          return (
            <motion.circle
              key={p.id}
              r={4.5}
              initial={{ cx: xs[0], cy: ys[0], opacity: 0, fill: startColor }}
              animate={{ cx: xs, cy: ys, opacity: op, fill: xs.map((_, i) => (i < a.xs.length ? startColor : color)) }}
              transition={{ duration: 1.8, delay: p.delay, ease: 'easeInOut' }}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute bottom-1 left-2 flex flex-wrap gap-3 text-[10px] font-medium text-ink-400">
        {(
          [
            ['shared', 'exact'],
            ['minimized', 'minimized'],
            ['tokenized', 'tokenized'],
            ['withheld', 'withheld / blocked'],
            ['query', 'public query'],
          ] as const
        ).map(([k, l]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: OUTCOME_COLOR[k] }} /> {l}
          </span>
        ))}
      </div>
    </div>
  );
}
