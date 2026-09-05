import { useState, useEffect } from 'react';
import './App.css';
import LiveAgent from './Live_Agent';

const API_BASE = 'http://localhost:5000';

const STATUS_CONFIG = {
  notify: { label: 'Notify', color: '#16a34a', bg: '#dcfce7' },
  escalate: { label: 'Escalate', color: '#16a34a', bg: '#dcfce7' },
  held: { label: 'Held', color: '#ca8a04', bg: '#fef9c3' },
  ignored: { label: 'Ignored', color: '#6b7280', bg: '#f3f4f6' },
  blocked_by_guardrail: { label: 'Blocked', color: '#dc2626', bg: '#fee2e2' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'notified', label: 'Notified' },
  { key: 'held', label: 'Held' },
  { key: 'ignored', label: 'Ignored' },
];

const RECIPIENTS = [
  { label: "My Test Number", value: "919172870354" }, // your actual verified numbers
  { label: "Backup Test Number", value: "919322799854" },
];

function matchesFilter(event, filter) {
  if (filter === 'all') return true;
  if (filter === 'notified') return ['notify', 'escalate'].includes(event.final_status);
  if (filter === 'held') return event.final_status === 'held';
  if (filter === 'ignored') return event.final_status === 'ignored';
  return true;
}

function formatCurrency(value) {
  const num = Number(value || 0);
  return '\u20B9' + num.toLocaleString('en-IN');
}

function formatPercent(value) {
  const num = Number(value || 0);
  if (num <= 1) return (num * 100).toFixed(1) + '%';
  return num.toFixed(1) + '%';
}

function formatConfidence(value) {
  const num = Number(value || 0);
  if (num <= 1) return (num * 100).toFixed(0) + '%';
  return num.toFixed(0) + '%';
}

function getResolvedValue(resolved) {
  if (resolved === true || resolved === 'true' || resolved === 'True' || resolved === 1) return true;
  if (resolved === false || resolved === 'false' || resolved === 'False' || resolved === 0) return false;
  return null;
}

/* ---------- Icons ---------- */

function TotalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function AccuracyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

function NotifyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function HeldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function RevenueIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

/* ---------- Stat Card ---------- */

function StatCard({ icon: Icon, value, label, accent }) {
  return (
    <div className="metric-card">
      <div className="metric-icon" style={{ color: accent, backgroundColor: accent + '14' }}>
        <Icon />
      </div>
      <div className="metric-body">
        <div className="metric-value">{value}</div>
        <div className="metric-label">{label}</div>
      </div>
    </div>
  );
}

/* ---------- Event Row ---------- */

function EventRow({ event, isExpanded, onToggle }) {
  const status = STATUS_CONFIG[event.final_status] || STATUS_CONFIG.ignored;
  const resolved = getResolvedValue(event.resolved);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [recipient, setRecipient] = useState(RECIPIENTS[0].value); 

  const canSend = ['notify', 'escalate'].includes(event.final_status);

  async function handleSendWhatsApp(e) {
    e.stopPropagation();
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`${API_BASE}/send-whatsapp/${event.event_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // ADD
        body: JSON.stringify({ recipient })                // ADD
      });
      const data = await res.json();
      setSendResult(data.success ? { ok: true, text: 'Sent successfully' } : { ok: false, text: data.error || 'Failed' });
    } catch (err) {
      setSendResult({ ok: false, text: 'Failed to reach server' });
    }
    setSending(false);
  }

  return (
    <div className="event-row-wrapper">
      <div className="flash-overlay" />
      <div className="event-row" onClick={() => onToggle(event.event_id)}>
        <div className="cell">{event.customer_id}</div>
        <div className="cell mono">{event.error_code}</div>
        <div className="cell">{formatCurrency(event.cart_value)}</div>
        <div className="cell diagnosis">
          <span className="diagnosis-text">{event.predicted_category || '\u2014'}</span>
          {event.diagnosis_confidence != null && (
            <span className="confidence">{formatConfidence(event.diagnosis_confidence)}</span>
          )}
        </div>
        <div className="cell action-cell">
          <span className="badge" style={{ color: status.color, backgroundColor: status.bg }}>
            {status.label}
          </span>
          <span className={`chevron ${isExpanded ? 'chevron-open' : ''}`}>&#8250;</span>
        </div>
      </div>

      {isExpanded && (
        <div className="event-detail">
          <div className="detail-event-id">Event #{event.event_id}</div>
          <div className="detail-grid">
            {/* Diagnosis */}
            <div className="detail-section">
              <div className="detail-label">AI Diagnosis</div>
              <div className="detail-content">
                <div className="detail-field">
                  <span className="field-key">Predicted Category</span>
                  <span className="field-value">{event.predicted_category || '\u2014'}</span>
                </div>
                <div className="detail-field">
                  <span className="field-key">True Category</span>
                  <span className="field-value">{event.true_category || '\u2014'}</span>
                </div>
                <div className="detail-field">
                  <span className="field-key">Confidence</span>
                  <span className="field-value">
                    {event.diagnosis_confidence != null ? formatConfidence(event.diagnosis_confidence) : '\u2014'}
                  </span>
                </div>
                {event.diagnosis_reasoning && (
                  <div className="detail-field">
                    <span className="field-key">Reasoning</span>
                    <span className="field-value reasoning-text">{event.diagnosis_reasoning}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Resolution Detector */}
            <div className="detail-section">
              <div className="detail-label">Resolution Detector</div>
              <div className="detail-content">
                <div className="detail-field">
                  <span className="field-key">Resolved</span>
                  <span className="field-value">
                    {resolved !== null ? (
                      <span className={`resolved-badge ${resolved ? 'resolved-yes' : 'resolved-no'}`}>
                        {resolved ? 'Resolved' : 'Not Resolved'}
                      </span>
                    ) : (
                      '\u2014'
                    )}
                  </span>
                </div>
                {event.resolution_reason && (
                  <div className="detail-field">
                    <span className="field-key">Reason</span>
                    <span className="field-value reasoning-text">{event.resolution_reason}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Intervention Agent */}
            <div className="detail-section">
              <div className="detail-label">Intervention Agent</div>
              <div className="detail-content">
                <div className="detail-field">
                  <span className="field-key">Action</span>
                  <span className="field-value">{event.action || '\u2014'}</span>
                </div>
                <div className="detail-field">
                  <span className="field-key">Final Status</span>
                  <span className="field-value">
                    <span className="badge" style={{ color: status.color, backgroundColor: status.bg }}>
                      {status.label}
                    </span>
                  </span>
                </div>
                {event.intervention_reasoning && (
                  <div className="detail-field">
                    <span className="field-key">Reasoning</span>
                    <span className="field-value reasoning-text">{event.intervention_reasoning}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Message */}
            {event.message && (
              <div className="detail-section message-section">
                <div className="detail-label">Generated Customer Message</div>
                <div className="detail-content">
                  <div className="message-text">{event.message}</div>

                  {canSend && (
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <select
                        value={recipient}
                        onChange={(e) => { e.stopPropagation(); setRecipient(e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                      >
                        {RECIPIENTS.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <button onClick={handleSendWhatsApp} disabled={sending} className="replay-btn" style={{ fontSize: '13px' }}>
                        {sending ? 'Sending…' : 'Send WhatsApp'}
                      </button>
                      {sendResult && (
                        <span style={{ fontSize: '13px', color: sendResult.ok ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                          {sendResult.ok ? '✓ ' : '✕ '}{sendResult.text}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- App ---------- */

function App() {
  const [metrics, setMetrics] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [expandedRow, setExpandedRow] = useState(null);
  const [filter, setFilter] = useState('all');
  const [replayKey, setReplayKey] = useState(0);
  const [page, setPage] = useState('dashboard');
  

  // Fetch data on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [metricsRes, eventsRes] = await Promise.all([
          fetch(`${API_BASE}/batch-metrics`),
          fetch(`${API_BASE}/batch-results`),
        ]);

        if (!metricsRes.ok || !eventsRes.ok) {
          throw new Error(`HTTP ${metricsRes.status} / ${eventsRes.status}`);
        }

        const metricsData = await metricsRes.json();
        const eventsData = await eventsRes.json();

        if (cancelled) return;

        setMetrics(metricsData);
        setEvents(Array.isArray(eventsData) ? eventsData : (eventsData.results || []));
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Staggered row animation
  useEffect(() => {
    if (loading || events.length === 0) return;

    setVisibleCount(0);
    const timers = [];

    events.forEach((_, i) => {
      const timer = setTimeout(() => {
        setVisibleCount(i + 1);
      }, i * 200);
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, [loading, events, replayKey]);

  const handleReplay = () => {
    setExpandedRow(null);
    setReplayKey((k) => k + 1);
  };

  const handleRowToggle = (eventId) => {
    setExpandedRow((prev) => (prev === eventId ? null : eventId));
  };

  const isProcessing = visibleCount < events.length;
  const visibleEvents = events.slice(0, visibleCount);
  const filteredEvents = visibleEvents.filter((e) => matchesFilter(e, filter));

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <div className="logo-mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h4l3-9 4 18 3-9h4" />
            </svg>
          </div>
          <div className="logo-text">
            <div className="logo-name">ReviveIQ</div>
            <div className="tagline">AI-powered payment failure recovery</div>
          </div>
        </div>

        <div className="header-right">
          <button className={`replay-btn ${page === 'dashboard' ? 'active' : ''}`} onClick={() => setPage('dashboard')}>Dashboard</button>
          <button className={`replay-btn ${page === 'live' ? 'active' : ''}`} onClick={() => setPage('live')}>Live Agent</button>
          {/* <div className={`live-indicator ${isProcessing ? 'processing' : 'live'}`}>
            <span className="live-dot" />
            <span className="live-label">{isProcessing ? 'Processing' : 'Live'}</span>
          </div>
          <button className="replay-btn" onClick={handleReplay}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Replay
          </button> */}
        </div>
      </header>

      {/* Loading */}
      {loading && (
        <div className="loading-state">
          <div className="loading-spinner" />
          <div className="loading-text">Connecting to ReviveIQ engine…</div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="error-state">
          <div className="error-icon">⚠</div>
          <div className="error-text">Unable to connect to the backend.</div>
          <div className="error-hint">Make sure the server is running on port 5000.</div>
        </div>
      )}

      {/* Content */}
      {/* Content */}
      {page === 'dashboard' && !loading && !error && metrics && (
        <>
          <div className="metrics-row">
            <StatCard icon={TotalIcon} value={metrics.total ?? '\u2014'} label="Total Events" accent="#0d9488" />
            <StatCard icon={AccuracyIcon} value={formatPercent(metrics.diagnosis_accuracy)} label="Diagnosis Accuracy" accent="#0d9488" />
            <StatCard icon={NotifyIcon} value={metrics.notified_count ?? 0} label="Notified / Escalated" accent="#16a34a" />
            <StatCard icon={HeldIcon} value={metrics.held_count ?? 0} label="Correctly Held Back" accent="#ca8a04" />
            <StatCard icon={RevenueIcon} value={formatCurrency(metrics.revenue_recovered)} label="Revenue Recovered" accent="#0d9488" />
          </div>

          <div className="feed-container">
            <div className="feed-header-bar">
              <div className="feed-title">
                Event Feed
                <span className="feed-count">
                  {visibleCount} / {events.length} processed
                </span>
              </div>
              <div className="filter-bar">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    className={`filter-tab ${filter === f.key ? 'active' : ''}`}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="feed-table">
              <div className="feed-table-header">
                <div className="cell">Customer ID</div>
                <div className="cell">Error Code</div>
                <div className="cell">Cart Value</div>
                <div className="cell">AI Diagnosis</div>
                <div className="cell">Action</div>
              </div>

              <div className="feed-table-body" key={replayKey}>
                {filteredEvents.length === 0 && visibleCount > 0 && (
                  <div className="empty-state">No events match this filter.</div>
                )}
                {filteredEvents.map((event) => (
                  <EventRow
                    key={event.event_id}
                    event={event}
                    isExpanded={expandedRow === event.event_id}
                    onToggle={handleRowToggle}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {page === 'live' && (
        <div style={{ marginTop: '20px' }}>
          <LiveAgent />
        </div>
      )}
    </div>
  );
}

export default App;
