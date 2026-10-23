import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { connect } from './lib/client';
import { useApp } from './lib/store';
import { Layout } from './components/Layout';
import { Logo } from './components/ui';
import Command from './pages/Command';
import Vault from './pages/Vault';
import Footprint from './pages/Footprint';
import Policies from './pages/Policies';
import Ledger from './pages/Ledger';
import Connections from './pages/Connections';
import RedTeam from './pages/RedTeam';
import Settings from './pages/Settings';

// Recording mode for the product video: frees the sidebar's bottom-left corner for the webcam circle.
try {
  if (localStorage.getItem('consentry:recording') === '1') document.documentElement.classList.add('recording');
} catch {
  /* storage blocked */
}

function Boot() {
  const init = useApp((s) => s.init);
  const snap = useApp((s) => s.snap);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    connect()
      .then((c) => init(c))
      .catch((e) => setError(String(e?.message ?? e)));
  }, [init]);

  if (!snap)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="animate-pulse">
          <Logo size={64} />
        </div>
        <div className="text-sm text-ink-300">{error ? `Could not start: ${error}` : 'Starting the firewall…'}</div>
      </div>
    );

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Command />} />
          <Route path="footprint" element={<Footprint />} />
          <Route path="vault" element={<Vault />} />
          <Route path="policies" element={<Policies />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="connections" element={<Connections />} />
          <Route path="redteam" element={<RedTeam />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Command />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boot />
  </StrictMode>,
);
