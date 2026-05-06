import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const PURITIES = [
  { key: 'gold_rate_9k',  label: '9K Gold',  karat: 9  },
];

export default function Home() {
  const [authed,    setAuthed]    = useState(false);
  const [password,  setPassword]  = useState('');
  const [authError, setAuthError] = useState('');
  const [rates,     setRates]     = useState({ gold_rate_9k: '', gst_percent: '' });
  const [saving,    setSaving]    = useState(false);
  const [running,   setRunning]   = useState(false);
  const [log,       setLog]       = useState([]);
  const [stats,     setStats]     = useState({ total: 0, updated: 0, skipped: 0 });
  const [saveMsg,   setSaveMsg]   = useState('');
  const logRef = useRef(null);

  useEffect(() => {
    // Check session
    const saved = sessionStorage.getItem('gpm_auth');
    if (saved === 'true') { setAuthed(true); loadRates(); }
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  async function login() {
    setAuthError('');
    const res = await fetch('/api/get-rates', { headers: { 'x-admin-password': password } });
    if (res.status === 401) { setAuthError('Wrong password. Try again.'); return; }
    const data = await res.json();
    setRates(data);
    sessionStorage.setItem('gpm_auth', 'true');
    sessionStorage.setItem('gpm_pass', password);
    setAuthed(true);
  }

  async function loadRates() {
    const pass = sessionStorage.getItem('gpm_pass');
    const res  = await fetch('/api/get-rates', { headers: { 'x-admin-password': pass } });
    const data = await res.json();
    setRates(data);
  }

  async function saveRates() {
    setSaving(true); setSaveMsg('');
    const pass = sessionStorage.getItem('gpm_pass');
    const res  = await fetch('/api/save-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': pass },
      body: JSON.stringify(rates),
    });
    setSaving(false);
    setSaveMsg(res.ok ? '✓ Rates saved successfully!' : '✗ Failed to save rates.');
    setTimeout(() => setSaveMsg(''), 4000);
  }

  async function recalculate() {
    setRunning(true);
    setLog([]);
    setStats({ total: 0, updated: 0, skipped: 0 });
    const pass = sessionStorage.getItem('gpm_pass');

    const res = await fetch('/api/recalculate', {
      method: 'POST',
      headers: { 'x-admin-password': pass },
    });

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          handleEvent(event);
        } catch {}
      }
    }
    setRunning(false);
  }

  function handleEvent(event) {
    if (event.type === 'total')   { setStats(s => ({ ...s, total: event.count })); }
    if (event.type === 'status')  { setLog(l => [...l, { type: 'info',    text: event.message }]); }
    if (event.type === 'product') {
      const icon = event.status === 'updated' ? '✓' : event.status === 'skipped' ? '—' : '✗';
      const cls  = event.status === 'updated' ? 'success' : event.status === 'skipped' ? 'skip' : 'error';
      setLog(l => [...l, { type: cls, text: `${icon} ${event.name}${event.reason ? ' — ' + event.reason : ''}` }]);
      if (event.status === 'updated') setStats(s => ({ ...s, updated: s.updated + 1 }));
      if (event.status === 'skipped') setStats(s => ({ ...s, skipped: s.skipped + 1 }));
    }
    if (event.type === 'done') {
      setLog(l => [...l, { type: 'done', text: `✓ Done — ${event.updated} updated, ${event.skipped} skipped as non-gold` }]);
    }
    if (event.type === 'error') {
      setLog(l => [...l, { type: 'error', text: `✗ Error: ${event.message}` }]);
    }
  }

  function logout() {
    sessionStorage.clear();
    setAuthed(false);
    setPassword('');
  }

  // ── Login Screen ─────────────────────────────────────────────────────────────
  if (!authed) return (
    <>
      <Head><title>Gold Price Manager</title></Head>
      <style>{globalStyles}</style>
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-logo">◈</div>
          <h1 className="login-title">Gold Price Manager</h1>
          <p className="login-sub">Enter your admin password to continue</p>
          <input
            className="input"
            type="password"
            placeholder="Admin Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
          />
          {authError && <p className="error-msg">{authError}</p>}
          <button className="btn-primary" onClick={login}>Login →</button>
        </div>
      </div>
    </>
  );

  // ── Main Dashboard ────────────────────────────────────────────────────────────
  const progress = stats.total > 0 ? Math.round(((stats.updated + stats.skipped) / stats.total) * 100) : 0;

  return (
    <>
      <Head><title>Gold Price Manager</title></Head>
      <style>{globalStyles}</style>
      <div className="app">

        {/* Header */}
        <header className="header">
          <div className="header-inner">
            <div className="header-brand">
              <span className="brand-icon">◈</span>
              <span className="brand-name">Gold Price Manager</span>
            </div>
            <button className="btn-ghost" onClick={logout}>Logout</button>
          </div>
        </header>

        <main className="main">

          {/* Gold Rates Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Gold Rate — 9K (Today)</h2>
              <p className="card-sub">Enter the 9K gold rate per gram (changes daily)</p>
            </div>

            <div className="rates-grid">
              {PURITIES.map(p => (
                <div key={p.key} className="rate-item">
                  <label className="rate-label">
                    <span className="rate-karat">{p.label}</span>
                    <span className="rate-purity">{p.karat}/24 pure</span>
                  </label>
                  <div className="rate-input-wrap">
                    <span className="rate-symbol">₹</span>
                    <input
                      className="rate-input"
                      type="number"
                      placeholder="0.00"
                      value={rates[p.key]}
                      onChange={e => setRates(r => ({ ...r, [p.key]: e.target.value }))}
                    />
                    <span className="rate-unit">/g</span>
                  </div>
                </div>
              ))}
            </div>

            {/* GST */}
            <div className="gst-row">
              <label className="rate-label">
                <span className="rate-karat">GST Percentage</span>
                <span className="rate-purity">Applied on final output</span>
              </label>
              <div className="rate-input-wrap" style={{ maxWidth: 200 }}>
                <input
                  className="rate-input"
                  type="number"
                  placeholder="3"
                  value={rates.gst_percent}
                  onChange={e => setRates(r => ({ ...r, gst_percent: e.target.value }))}
                />
                <span className="rate-unit">%</span>
              </div>
            </div>

            {/* Save Button */}
            <div className="card-footer">
              {saveMsg && <span className={saveMsg.startsWith('✓') ? 'msg-success' : 'msg-error'}>{saveMsg}</span>}
              <button className="btn-primary" onClick={saveRates} disabled={saving}>
                {saving ? 'Saving...' : 'Save Rates'}
              </button>
            </div>
          </div>

          {/* Recalculate Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Update All Product Prices</h2>
              <p className="card-sub">Save rates first, then click below to recalculate and update all products in Shopify</p>
            </div>

            <div className="formula-box">
              <p className="formula-title">Formula being applied (9K Gold Only):</p>
              <p className="formula-text">
                <strong>TGP</strong> = Gold Price (9K) × Weight of Metal<br />
                <strong>TGPM</strong> = TGP + (Fixed Making Charge × Weight of Metal)<br />
                <strong>Output</strong> = TGPM + Diamond Price (if available) + Stone Price (if available)<br />
                <strong>Final Price</strong> = Output + GST %
              </p>
              <p className="formula-note">Products without gold weight are skipped automatically.</p>
            </div>

            <button
              className="btn-update"
              onClick={recalculate}
              disabled={running}
            >
              {running ? '⟳ Updating Prices...' : '⚡ Update All Prices Now'}
            </button>

            {/* Progress */}
            {(running || log.length > 0) && (
              <div className="progress-section">
                {stats.total > 0 && (
                  <>
                    <div className="progress-bar-wrap">
                      <div className="progress-bar" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="progress-stats">
                      <span>{stats.updated} updated</span>
                      <span>{stats.skipped} skipped</span>
                      <span>{stats.total} total</span>
                    </div>
                  </>
                )}
                <div className="log-box" ref={logRef}>
                  {log.map((l, i) => (
                    <div key={i} className={`log-line log-${l.type}`}>{l.text}</div>
                  ))}
                  {running && <div className="log-line log-info">⟳ Processing...</div>}
                </div>
              </div>
            )}
          </div>

          {/* Formula Reference */}
          <div className="card card-slim">
            <h3 className="card-title" style={{ fontSize: 14 }}>Quick Reference — Product Metafields to Fill in Shopify</h3>
            <table className="ref-table">
              <thead><tr><th>Metafield</th><th>What to enter</th></tr></thead>
              <tbody>
                <tr><td>gold_weight_grams</td><td>Weight of gold in grams</td></tr>
                <tr><td>diamond_value</td><td>Direct ₹ value of diamond (0 if none)</td></tr>
                <tr><td>stone_price</td><td>Fixed ₹ value of stones (0 if none)</td></tr>
                <tr><td>making_charge_fixed</td><td>Fixed making charge per gram of gold in ₹</td></tr>
              </tbody>
            </table>
          </div>

        </main>
      </div>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const globalStyles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f5f0; color: #1a1a1a; }

  /* Login */
  .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1a1a1a 0%, #2d2416 100%); }
  .login-card { background: #fff; border-radius: 16px; padding: 48px 40px; width: 100%; max-width: 400px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
  .login-logo { font-size: 48px; margin-bottom: 16px; color: #c9a84c; }
  .login-title { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
  .login-sub { color: #666; margin-bottom: 32px; font-size: 14px; }
  .error-msg { color: #e53e3e; font-size: 13px; margin: -8px 0 12px; }

  /* App */
  .app { min-height: 100vh; }
  .header { background: #1a1a1a; color: #fff; padding: 0 24px; }
  .header-inner { max-width: 860px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; height: 60px; }
  .header-brand { display: flex; align-items: center; gap: 10px; }
  .brand-icon { color: #c9a84c; font-size: 20px; }
  .brand-name { font-weight: 600; font-size: 16px; letter-spacing: 0.3px; }

  .main { max-width: 860px; margin: 32px auto; padding: 0 24px; display: flex; flex-direction: column; gap: 24px; }

  /* Cards */
  .card { background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
  .card-slim { padding: 24px; }
  .card-header { margin-bottom: 28px; }
  .card-title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .card-sub { color: #666; font-size: 13px; }
  .card-footer { display: flex; align-items: center; justify-content: flex-end; gap: 16px; margin-top: 28px; border-top: 1px solid #f0ece4; padding-top: 24px; }

  /* Rates Grid */
  .rates-grid { display: grid; grid-template-columns: 1fr; gap: 16px; max-width: 320px; }
  .rate-item { background: #fdf9f0; border: 1px solid #f0e8d0; border-radius: 10px; padding: 16px 20px; }
  .rate-label { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
  .rate-karat { font-weight: 600; font-size: 15px; }
  .rate-purity { color: #999; font-size: 12px; }
  .rate-input-wrap { display: flex; align-items: center; gap: 8px; }
  .rate-symbol { font-size: 16px; color: #c9a84c; font-weight: 600; }
  .rate-input { flex: 1; border: 1px solid #e0d8c8; border-radius: 6px; padding: 8px 12px; font-size: 16px; font-weight: 600; background: #fff; outline: none; transition: border-color 0.2s; }
  .rate-input:focus { border-color: #c9a84c; }
  .rate-unit { color: #999; font-size: 13px; }
  .gst-row { margin-top: 16px; background: #f5f5f5; border: 1px solid #e8e8e8; border-radius: 10px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }

  /* Buttons */
  .input { width: 100%; padding: 12px 16px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 15px; margin-bottom: 16px; outline: none; }
  .input:focus { border-color: #c9a84c; }
  .btn-primary { background: #1a1a1a; color: #fff; border: none; border-radius: 8px; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; width: 100%; }
  .btn-primary:hover:not(:disabled) { background: #333; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-ghost { background: transparent; color: #aaa; border: 1px solid #444; border-radius: 6px; padding: 6px 14px; font-size: 13px; cursor: pointer; }
  .btn-ghost:hover { color: #fff; border-color: #888; }
  .btn-update { width: 100%; padding: 16px; background: linear-gradient(135deg, #c9a84c, #a8832a); color: #fff; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; letter-spacing: 0.3px; transition: opacity 0.2s; }
  .btn-update:hover:not(:disabled) { opacity: 0.9; }
  .btn-update:disabled { opacity: 0.6; cursor: not-allowed; }

  /* Formula box */
  .formula-box { background: #f7f5f0; border-left: 3px solid #c9a84c; border-radius: 6px; padding: 16px 20px; margin-bottom: 24px; }
  .formula-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #999; margin-bottom: 10px; }
  .formula-text { font-size: 14px; line-height: 2; color: #333; }
  .formula-note { margin-top: 12px; font-size: 12px; color: #999; }

  /* Progress */
  .progress-section { margin-top: 24px; }
  .progress-bar-wrap { height: 6px; background: #f0ece4; border-radius: 99px; overflow: hidden; margin-bottom: 8px; }
  .progress-bar { height: 100%; background: linear-gradient(90deg, #c9a84c, #a8832a); border-radius: 99px; transition: width 0.3s; }
  .progress-stats { display: flex; gap: 16px; font-size: 12px; color: #666; margin-bottom: 16px; }
  .log-box { background: #1a1a1a; border-radius: 8px; padding: 16px; max-height: 260px; overflow-y: auto; font-family: monospace; font-size: 13px; }
  .log-line { padding: 2px 0; }
  .log-success { color: #68d391; }
  .log-skip    { color: #a0aec0; }
  .log-error   { color: #fc8181; }
  .log-info    { color: #63b3ed; }
  .log-done    { color: #f6e05e; font-weight: bold; }

  /* Table */
  .ref-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
  .ref-table th { text-align: left; padding: 8px 12px; background: #f7f5f0; font-weight: 600; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .ref-table td { padding: 8px 12px; border-top: 1px solid #f0ece4; color: #444; font-family: monospace; }
  .ref-table tr:first-child td { border-top: none; }

  .msg-success { color: #38a169; font-size: 13px; font-weight: 600; }
  .msg-error   { color: #e53e3e; font-size: 13px; font-weight: 600; }

  @media (max-width: 600px) {
    .main { padding: 0 16px; margin: 16px auto; }
    .card { padding: 20px; }
    .rates-grid { grid-template-columns: 1fr; }
    .gst-row { flex-direction: column; align-items: flex-start; }
  }
`;
