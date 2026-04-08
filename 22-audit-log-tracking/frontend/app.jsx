import React, { useState, useRef } from "react";
import { checkConnection, logAction, logAccess, flagEntry, getEntry, listEntries, getEntryCount, getFlaggedCount } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

export default function App() {
    const [form, setForm] = useState({
        id: "log1",
        actor: "",
        actionType: "update",
        target: "user_profile",
        description: "Modified user settings",
        severity: "2",
        timestamp: String(nowTs()),
        resource: "/api/data",
        accessType: "read",
        reason: "Suspicious access pattern",
    });
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [walletState, setWalletState] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [entryCount, setEntryCount] = useState("-");
    const [flaggedCount, setFlaggedCount] = useState("-");
    const [activeTab, setActiveTab] = useState("logAction");
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
            setForm((prev) => ({ ...prev, actor: user.publicKey }));
            return `Connected: ${user.publicKey}`;
        }
        setWalletState(null);
        return "Wallet: not connected";
    });

    const onLogAction = () => runAction("logAction", async () =>
        logAction({
            id: form.id.trim(),
            actor: form.actor.trim(),
            actionType: form.actionType.trim(),
            target: form.target.trim(),
            description: form.description.trim(),
            severity: form.severity.trim(),
            timestamp: form.timestamp.trim(),
        })
    );

    const onLogAccess = () => runAction("logAccess", async () =>
        logAccess({
            id: form.id.trim(),
            accessor: form.actor.trim(),
            resource: form.resource.trim(),
            accessType: form.accessType.trim(),
            timestamp: form.timestamp.trim(),
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

    const onFlagEntry = () => handleDestructive("flag", () =>
        runAction("flagEntry", async () =>
            flagEntry({
                id: form.id.trim(),
                auditor: form.actor.trim(),
                reason: form.reason.trim(),
            })
        )
    );

    const onGetEntry = () => runAction("getEntry", async () => getEntry(form.id.trim()));

    const onListEntries = () => runAction("listEntries", async () => listEntries());

    const onGetCounts = () => runAction("getCounts", async () => {
        const total = await getEntryCount();
        const flagged = await getFlaggedCount();
        setEntryCount(String(total));
        setFlaggedCount(String(flagged));
        return { totalEntries: total, flaggedEntries: flagged };
    });

    const sevLevel = parseInt(form.severity, 10);
    const sevClass = sevLevel <= 1 ? "info" : sevLevel === 2 ? "warn" : "critical";
    const sevText = sevLevel <= 1 ? "INFO" : sevLevel === 2 ? "WARN" : "CRITICAL";

    const truncAddr = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
    const tabs = [
        { key: "logAction", label: "Log Action" },
        { key: "logAccess", label: "Log Access" },
        { key: "flagQuery", label: "Flag & Query" },
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
                <div className="hero-top">
                    <span className="shield-icon">&#128737;</span>
                    <span className="kicker">Stellar Soroban Project 22</span>
                </div>
                <h1>Audit Log Tracking</h1>
                <p className="subtitle">
                    Log actions, track access, flag suspicious entries, and query the audit trail on the blockchain.
                </p>
            </section>

            {/* Audit Dashboard Counters */}
            <div className="dashboard">
                <div className="counter">
                    <div className="counter-label">Total Entries</div>
                    <div className="counter-value">{entryCount}</div>
                </div>
                <div className="counter flagged">
                    <div className="counter-label">Flagged Entries</div>
                    <div className="counter-value">{flaggedCount}</div>
                </div>
                <div className="counter">
                    <div className="counter-label">Current Severity</div>
                    <div className="counter-value">
                        <span className={`sev-badge ${sevClass}`}>{sevText}</span>
                    </div>
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

            {/* Tab: Log Action */}
            {activeTab === "logAction" && (
                <section className="card">
                    <h2>Log Action</h2>
                    <div className="form-grid">
                        <div className="field">
                            <label htmlFor="id">Entry ID</label>
                            <input id="id" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Unique log entry identifier</span>
                        </div>
                        <div className="field">
                            <label htmlFor="actor">Actor Address</label>
                            <input id="actor" name="actor" value={form.actor} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key starting with G</span>
                        </div>
                        <div className="field">
                            <label htmlFor="actionType">Action Type</label>
                            <input id="actionType" name="actionType" value={form.actionType} onChange={setField} placeholder="update/delete/create" />
                        </div>
                        <div className="field">
                            <label htmlFor="target">Target</label>
                            <input id="target" name="target" value={form.target} onChange={setField} />
                        </div>
                        <div className="field full">
                            <label htmlFor="description">Description</label>
                            <input id="description" name="description" value={form.description} onChange={setField} />
                        </div>
                        <div className="field">
                            <label htmlFor="severity">Severity (0-5)</label>
                            <input id="severity" name="severity" value={form.severity} onChange={setField} type="number" />
                            <div className="severity-indicator">
                                <span className={`sev-badge ${sevClass}`}>Level {form.severity}: {sevText}</span>
                            </div>
                        </div>
                        <div className="field">
                            <label htmlFor="timestamp">Timestamp (u64)</label>
                            <input id="timestamp" name="timestamp" value={form.timestamp} onChange={setField} type="number" />
                            <span className="helper">Unix timestamp in seconds</span>
                        </div>
                    </div>
                    <div className="card-actions">
                        <button
                            type="button"
                            className={`btn-primary ${loadingAction === "logAction" ? "btn-loading" : ""}`}
                            onClick={onLogAction}
                            disabled={isBusy}
                        >
                            Log Action
                        </button>
                    </div>
                </section>
            )}

            {/* Tab: Log Access */}
            {activeTab === "logAccess" && (
                <section className="card">
                    <h2>Log Access</h2>
                    <div className="form-grid">
                        <div className="field full">
                            <label htmlFor="resource">Resource Path</label>
                            <input id="resource" name="resource" value={form.resource} onChange={setField} />
                            <span className="helper">API endpoint or resource path, e.g. /api/data</span>
                        </div>
                        <div className="field">
                            <label htmlFor="accessType">Access Type</label>
                            <input id="accessType" name="accessType" value={form.accessType} onChange={setField} placeholder="read/write/delete" />
                        </div>
                    </div>
                    <div className="card-actions">
                        <button
                            type="button"
                            className={`btn-primary ${loadingAction === "logAccess" ? "btn-loading" : ""}`}
                            onClick={onLogAccess}
                            disabled={isBusy}
                        >
                            Log Access
                        </button>
                    </div>
                </section>
            )}

            {/* Tab: Flag & Query */}
            {activeTab === "flagQuery" && (
                <>
                    <section className="card">
                        <h2>Flag Entry</h2>
                        <div className="form-grid">
                            <div className="field full">
                                <label htmlFor="reason">Flag Reason</label>
                                <input id="reason" name="reason" value={form.reason} onChange={setField} />
                                <span className="helper">Describe why this entry is suspicious</span>
                            </div>
                        </div>
                        <div className="card-actions">
                            <button
                                type="button"
                                className={`btn-destructive ${loadingAction === "flagEntry" ? "btn-loading" : ""}`}
                                onClick={onFlagEntry}
                                disabled={isBusy}
                            >
                                {confirmingBtn === "flag" ? "Confirm Flag?" : "Flag Entry"}
                            </button>
                        </div>
                    </section>

                    <section className="card">
                        <h2>Audit Query</h2>
                        <div className="query-bar">
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "getEntry" ? "btn-loading" : ""}`}
                                onClick={onGetEntry}
                                disabled={isBusy}
                            >
                                Get Entry
                            </button>
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "listEntries" ? "btn-loading" : ""}`}
                                onClick={onListEntries}
                                disabled={isBusy}
                            >
                                List Entries
                            </button>
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "getCounts" ? "btn-loading" : ""}`}
                                onClick={onGetCounts}
                                disabled={isBusy}
                            >
                                Refresh Counts
                            </button>
                        </div>
                    </section>
                </>
            )}

            {/* Console Output */}
            <section className="card">
                <h2>Console Output</h2>
                <pre className={`console-output status-${status}`} id="output">
                    {output || "Execute an audit operation to see results here."}
                </pre>
            </section>
        </main>
    );
}
