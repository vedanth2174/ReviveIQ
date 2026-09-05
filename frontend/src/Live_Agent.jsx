import { useState } from 'react';

const API_BASE = 'http://localhost:5000';

const ERROR_PRESETS = {
    GATEWAY_TIMEOUT_5003: "Gateway timeout while processing transaction",
    BANK_API_5XX: "Issuer bank API returned 503 Service Unavailable",
    NPCI_UPI_TIMEOUT: "NPCI collect request timed out",
    INSUFFICIENT_FUNDS: "Issuer declined: insufficient funds",
    WRONG_OTP: "OTP verification failed",
    CARD_EXPIRED: "Card expired",
    UNKNOWN_DECLINE: "Transaction declined by issuer"
};

const CART_VALUES = [500, 3000, 8000, 13000, 18000];

const STAGE_CONFIG = {
    diagnosis: { title: 'AI Diagnosis', icon: '🤖', loadingText: 'Classifying failure reason…' },
    resolution: { title: 'Resolution Detector', icon: '⚙️', loadingText: 'Checking if issue is resolved…' },
    intervention: { title: 'Intervention Agent', icon: '🤖', loadingText: 'Deciding on action…' },
    message: { title: 'Message Generator', icon: '🤖', loadingText: 'Writing recovery message…' }
};

function formatCurrency(value) {
    return '\u20B9' + Number(value).toLocaleString('en-IN');
}

export default function LiveAgent() {
    const [errorCode, setErrorCode] = useState('GATEWAY_TIMEOUT_5003');
    const [cartValue, setCartValue] = useState(13000);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [visibleStages, setVisibleStages] = useState([]);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);
    const RECIPIENTS = [
        { label: "My Test Number", value: "919172870354" }, // replace with your actual verified numbers
        { label: "Backup Test Number", value: "919322799854" }, // add more if you have multiple verified test recipients
    ];
    const [recipient, setRecipient] = useState(RECIPIENTS[0].value);

    async function handleRun() {
        setRunning(true);
        setResult(null);
        setVisibleStages([]);
        setSendResult(null);

        try {
            const res = await fetch(`${API_BASE}/live-process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error_code: errorCode,
                    raw_error: ERROR_PRESETS[errorCode],
                    cart_value: cartValue,
                    customer_id: 'live_demo_customer'
                })
            });
            const data = await res.json();
            setResult(data);

            // reveal stages one at a time for the animation effect
            const stageKeys = ['diagnosis', 'resolution', 'intervention', 'message'].filter(k => data[k] !== undefined);
            stageKeys.forEach((key, i) => {
                setTimeout(() => {
                    setVisibleStages(prev => [...prev, key]);
                }, i * 900);
            });
        } catch (err) {
            setResult({ error: 'Failed to reach agent backend' });
        }
        setRunning(false);
    }

    async function handleSendWhatsApp() {
        if (!result?.event_id) return;
        setSending(true);
        setSendResult(null);
        try {
          const res = await fetch(`${API_BASE}/send-whatsapp/${result.event_id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient, cartValue, retryLink: result.retry_link })
          });
          const data = await res.json();
          setSendResult(data.success ? { ok: true, text: 'Sent successfully' } : { ok: false, text: data.error || 'Failed' });
        } catch {
          setSendResult({ ok: false, text: 'Failed to reach server' });
        }
        setSending(false);
      }

    const canSend = result && ['notify', 'escalate'].includes(result.final_status);

    return (
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            <div className="feed-container" style={{ padding: '24px', marginBottom: '24px' }}>
                <div className="feed-title" style={{ marginBottom: '18px' }}>Live Agent — Try It Yourself</div>

                <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                            Error Type
                        </label>
                        <select
                            value={errorCode}
                            onChange={e => setErrorCode(e.target.value)}
                            style={selectStyle}
                        >
                            {Object.keys(ERROR_PRESETS).map(code => (
                                <option key={code} value={code}>{code}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ flex: 1, minWidth: '160px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                            Cart Value
                        </label>
                        <select
                            value={cartValue}
                            onChange={e => setCartValue(Number(e.target.value))}
                            style={selectStyle}
                        >
                            {CART_VALUES.map(v => (
                                <option key={v} value={v}>{formatCurrency(v)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Send To
                    </label>
                    <select
                        value={recipient}
                        onChange={e => setRecipient(e.target.value)}
                        style={selectStyle}
                    >
                        {RECIPIENTS.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px', fontFamily: 'monospace' }}>
                    "{ERROR_PRESETS[errorCode]}"
                </div>

                <button
                    onClick={handleRun}
                    disabled={running}
                    className="replay-btn"
                    style={{ backgroundColor: 'var(--accent)', color: 'white', border: 'none', padding: '10px 20px', fontSize: '14px' }}
                >
                    {running ? 'Running…' : '▶ Run Agent'}
                </button>
            </div>

            {result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {['diagnosis', 'resolution', 'intervention', 'message'].map((key) => {
                        if (result[key] === undefined) return null;
                        const isVisible = visibleStages.includes(key);
                        const config = STAGE_CONFIG[key];

                        return (
                            <div
                                key={key}
                                className="feed-container"
                                style={{
                                    padding: '18px 20px',
                                    opacity: isVisible ? 1 : 0.3,
                                    transition: 'opacity 0.4s ease',
                                    borderLeft: isVisible ? '3px solid var(--accent)' : '3px solid var(--border)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span>{config.icon}</span>
                                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{config.title}</span>
                                    {!isVisible && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{config.loadingText}</span>}
                                </div>

                                {isVisible && key === 'diagnosis' && (
                                    <div style={{ fontSize: '13px' }}>
                                        <div><b>Category:</b> {result.diagnosis.category} ({Math.round(result.diagnosis.confidence * 100)}%)</div>
                                        <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{result.diagnosis.reasoning}</div>
                                    </div>
                                )}

                                {isVisible && key === 'resolution' && (
                                    <div style={{ fontSize: '13px' }}>
                                        <div><b>Resolved:</b> {result.resolution.resolved ? 'Yes' : 'No'}</div>
                                        <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{result.resolution.reason}</div>
                                    </div>
                                )}

                                {isVisible && key === 'intervention' && (
                                    <div style={{ fontSize: '13px' }}>
                                        <div><b>Action:</b> {result.intervention.action}</div>
                                        <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{result.intervention.reasoning}</div>
                                    </div>
                                )}

                                {isVisible && key === 'message' && (
                                    <div style={{ fontSize: '13px' }}>
                                        <div className="message-text" style={{ marginTop: '6px' }}>{result.message}</div>
                                        {canSend && (
                                            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <button onClick={handleSendWhatsApp} disabled={sending} className="replay-btn" style={{ fontSize: '13px' }}>
                                                    {sending ? 'Sending…' : 'Send WhatsApp'}
                                                </button>
                                                {sendResult && (
                                                    <span style={{ fontSize: '13px', fontWeight: 600, color: sendResult.ok ? '#16a34a' : '#dc2626' }}>
                                                        {sendResult.ok ? '✓ ' : '✕ '}{sendResult.text}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {result.final_status && visibleStages.length === Object.keys(STAGE_CONFIG).filter(k => result[k] !== undefined).length && (
                        <div style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: 'var(--accent)' }}>
                            Final status: {result.final_status.toUpperCase()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const selectStyle = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    fontSize: '13px',
    fontFamily: 'inherit',
    backgroundColor: 'white'
};