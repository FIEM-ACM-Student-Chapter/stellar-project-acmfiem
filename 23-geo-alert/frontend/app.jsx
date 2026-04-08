import React, { useState, useRef } from "react";
import { checkConnection, createAlert, acknowledgeAlert, resolveAlert, escalateAlert, getAlert, listAlerts, getActiveCount } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

export default function App() {
    const [form, setForm] = useState({
        id: "alert1",
        creator: "",
        title: "Road Closure",
        description: "Main street blocked due to construction",
        alertType: "traffic",
        latitude: "407128000",
        longitude: "-740060000",
        radius: "500",
        severity: "3",
        expiresAt: String(nowTs() + 86400),
        responder: "",
    });
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [walletState, setWalletState] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [activeCount, setActiveCount] = useState("-");
    const [activeTab, setActiveTab] = useState("create");
    const confirmTimers = useRef({});
    const [confirmingBtn, setConfirmingBtn] = useState(null);

    const setField = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const runAction = async (actionName, action) => {
        setIsBusy(true);
        setLoadingAction(actionName);
        setStatus("idle");
        try {
            const result = await action();
            setOutput(toOutput(result ?? "No data found"));
            setStatus("success");
        } catch (error) {
            setOutput(error?.message || String(error));
            setStatus("error");
        } finally {
            setIsBusy(false);
            setLoadingAction(null);
        }
    };

    const onConnect = () => runAction("connect", async () => {
        const user = await checkConnection();
        if (user) {
            setWalletState(user.publicKey);
            setForm((prev) => ({
                ...prev,
                creator: user.publicKey,
                responder: prev.responder || user.publicKey,
            }));
            return `Connected: ${user.publicKey}`;
        }
        setWalletState(null);
        return "Wallet: not connected";
    });

    const onCreateAlert = () => runAction("createAlert", async () =>
        createAlert({
            id: form.id.trim(),
            creator: form.creator.trim(),
            title: form.title.trim(),
            description: form.description.trim(),
            alertType: form.alertType.trim(),
            latitude: form.latitude.trim(),
            longitude: form.longitude.trim(),
            radius: form.radius.trim(),
            severity: form.severity.trim(),
            expiresAt: form.expiresAt.trim(),
        })
    );

    const onAcknowledge = () => runAction("acknowledge", async () =>
        acknowledgeAlert({
            id: form.id.trim(),
            responder: form.responder.trim() || form.creator.trim(),
        })
    );

    const onResolve = () => runAction("resolve", async () =>
        resolveAlert({
            id: form.id.trim(),
            creator: form.creator.trim(),
        })
    );

    const handleDestructive = (btnKey, action) => {
        if (confirmingBtn === btnKey) {
            clearTimeout(confirmTimers.current[btnKey]);
            setConfirmingBtn(null);
            action();
        } else {
            setConfirmingBtn(btnKey);
            confirmTimers.current[btnKey] = setTimeout(() => setConfirmingBtn(null), 3000);
        }
    };

    const onEscalate = () => handleDestructive("escalate", () =>
        runAction("escalate", async () =>
            escalateAlert({
                id: form.id.trim(),
                creator: form.creator.trim(),
            })
        )
    );

    const onGetAlert = () => runAction("getAlert", async () => getAlert(form.id.trim()));

    const onListAlerts = () => runAction("listAlerts", async () => listAlerts());

    const onGetActiveCount = () => runAction("getActiveCount", async () => {
        const value = await getActiveCount();
        setActiveCount(String(value));
        return { activeAlerts: value };
    });

    const sevNum = parseInt(form.severity, 10) || 0;

    const truncAddr = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
    const tabs = [
        { key: "create", label: "Create Alert" },
        { key: "response", label: "Response" },
        { key: "monitor", label: "Monitor" },
    ];

    return (
        <main className="app">
            {/* Wallet Status Bar */}
            <div className="wallet-status-bar">
                <div className="wallet-status-left">
                    <span className={`wallet-dot ${walletState ? "connected" : ""}`} />
                    <span className="wallet-addr">
                        {walletState ? truncAddr(walletState) : "Not connected"}
                    </span>
                </div>
                <button
                    type="button"
                    id="connectWallet"
                    onClick={onConnect}
                    disabled={isBusy}
                    className={loadingAction === "connect" ? "btn-loading" : ""}
                >
                    {walletState ? "Reconnect" : "Connect Freighter"}
                </button>
            </div>

            {/* Hero */}
            <section className="hero">
                <div className="hero-row">
                    <span className="alert-icon">&#128205;</span>
                    <span className="pulse-dot"></span>
                    <span className="kicker">Stellar Soroban Project 23</span>
                </div>
                <h1>Geo-based Alert System</h1>
                <p className="subtitle">
                    Create location-based alerts, acknowledge, escalate, and resolve them.
                    Coordinates use i128 scaled by 1e7 (e.g., 40.7128 N = 407128000).
                </p>
            </section>

            {/* Alert Monitor */}
            <div className="monitor-strip">
                <div className="monitor-box">
                    <div className="mon-label">Active Alerts</div>
                    <div className="mon-value">{activeCount}</div>
                </div>
                <div className="monitor-box">
                    <div className="mon-label">Current Alert</div>
                    <div className="mon-value" style={{ fontSize: "1.1rem" }}>{form.id}</div>
                </div>
                <div className="monitor-box">
                    <div className="mon-label">Severity</div>
                    <div className="mon-value">{form.severity}/5</div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="tab-bar">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        className={`tab-btn ${activeTab === t.key ? "active" : ""}`}
                        onClick={() => setActiveTab(t.key)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab: Create Alert */}
            {activeTab === "create" && (
                <section className="card">
                    <h2>Issue Alert</h2>
                    <div className="form-grid">
                        <div className="field">
                            <label htmlFor="id">Alert ID</label>
                            <input id="id" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Unique alert identifier</span>
                        </div>
                        <div className="field">
                            <label htmlFor="creator">Creator Address</label>
                            <input id="creator" name="creator" value={form.creator} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key starting with G</span>
                        </div>
                        <div className="field full">
                            <label htmlFor="title">Title</label>
                            <input id="title" name="title" value={form.title} onChange={setField} />
                        </div>
                        <div className="field full">
                            <label htmlFor="description">Description</label>
                            <input id="description" name="description" value={form.description} onChange={setField} />
                        </div>
                        <div className="field">
                            <label htmlFor="alertType">Alert Type</label>
                            <input id="alertType" name="alertType" value={form.alertType} onChange={setField} />
                        </div>
                        <div className="field">
                            <label htmlFor="severity">Severity (0-5)</label>
                            <input id="severity" name="severity" value={form.severity} onChange={setField} type="number" />
                            <div className="severity-band">
                                {[1, 2, 3, 4, 5].map((n) => (
                                    <div key={n} className={`sev-block ${sevNum >= n ? `active-${n}` : ""}`} />
                                ))}
                            </div>
                        </div>
                        <div className="field">
                            <label htmlFor="latitude">Latitude (i128)</label>
                            <input id="latitude" name="latitude" value={form.latitude} onChange={setField} type="number" />
                            <span className="helper">Scaled by 1e7, e.g. 407128000</span>
                        </div>
                        <div className="field">
                            <label htmlFor="longitude">Longitude (i128)</label>
                            <input id="longitude" name="longitude" value={form.longitude} onChange={setField} type="number" />
                            <span className="helper">Scaled by 1e7, e.g. -740060000</span>
                        </div>
                        <div className="field">
                            <label htmlFor="radius">Radius (meters)</label>
                            <input id="radius" name="radius" value={form.radius} onChange={setField} type="number" />
                            <span className="helper">Alert radius in meters</span>
                        </div>
                        <div className="field">
                            <label htmlFor="expiresAt">Expires At (u64)</label>
                            <input id="expiresAt" name="expiresAt" value={form.expiresAt} onChange={setField} type="number" />
                            <span className="helper">Unix timestamp in seconds</span>
                        </div>
                    </div>
                    <div className="btn-group">
                        <button
                            type="button"
                            className={`btn-primary ${loadingAction === "createAlert" ? "btn-loading" : ""}`}
                            onClick={onCreateAlert}
                            disabled={isBusy}
                        >
                            Issue Alert
                        </button>
                    </div>
                </section>
            )}

            {/* Tab: Response */}
            {activeTab === "response" && (
                <section className="card">
                    <h2>Alert Response</h2>
                    <div className="field" style={{ marginBottom: "1rem" }}>
                        <label htmlFor="responder">Responder Address</label>
                        <input id="responder" name="responder" value={form.responder} onChange={setField} placeholder="G..." />
                        <span className="helper">Stellar public key of the responder</span>
                    </div>
                    <div className="response-actions">
                        <button
                            type="button"
                            className={`btn-ack ${loadingAction === "acknowledge" ? "btn-loading" : ""}`}
                            onClick={onAcknowledge}
                            disabled={isBusy}
                        >
                            Acknowledge
                        </button>
                        <button
                            type="button"
                            className={`btn-resolve ${loadingAction === "resolve" ? "btn-loading" : ""}`}
                            onClick={onResolve}
                            disabled={isBusy}
                        >
                            Resolve
                        </button>
                        <button
                            type="button"
                            className={`btn-escalate ${loadingAction === "escalate" ? "btn-loading" : ""}`}
                            onClick={onEscalate}
                            disabled={isBusy}
                        >
                            {confirmingBtn === "escalate" ? "Confirm?" : "Escalate"}
                        </button>
                        <button
                            type="button"
                            className={`btn-ack ${loadingAction === "getActiveCount" ? "btn-loading" : ""}`}
                            onClick={onGetActiveCount}
                            disabled={isBusy}
                        >
                            Refresh Count
                        </button>
                    </div>
                </section>
            )}

            {/* Tab: Monitor */}
            {activeTab === "monitor" && (
                <section className="card">
                    <h2>Query Alerts</h2>
                    <div className="query-strip">
                        <button
                            type="button"
                            className={`btn-ghost ${loadingAction === "getAlert" ? "btn-loading" : ""}`}
                            onClick={onGetAlert}
                            disabled={isBusy}
                        >
                            Get Alert
                        </button>
                        <button
                            type="button"
                            className={`btn-ghost ${loadingAction === "listAlerts" ? "btn-loading" : ""}`}
                            onClick={onListAlerts}
                            disabled={isBusy}
                        >
                            List All
                        </button>
                    </div>
                </section>
            )}

            {/* Alert Feed / Output */}
            <section className="card alert-feed">
                <h2>Alert Feed</h2>
                <pre id="output" className={`status-${status}`}>
                    {output || "Issue or query alerts to see results here."}
                </pre>
            </section>
        </main>
    );
}
