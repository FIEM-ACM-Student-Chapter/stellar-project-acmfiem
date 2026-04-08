import React, { useState } from "react";
import { checkConnection, recordMetric, updateMetric, recordEvent, getMetric, listMetrics, getCategoryTotal, getMetricCount } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const truncateAddress = (addr) => addr && addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-6)}` : addr;

export default function App() {
    const [form, setForm] = useState({
        id: "metric1",
        reporter: "",
        metricName: "page_views",
        value: "100",
        newValue: "200",
        category: "traffic",
        eventType: "info",
        description: "System event recorded",
        timestamp: String(nowTs()),
    });
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [walletState, setWalletState] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [countValue, setCountValue] = useState("-");

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
            setForm((prev) => ({ ...prev, reporter: user.publicKey }));
            return `Connected: ${user.publicKey}`;
        }
        setWalletState(null);
        return "Wallet: not connected";
    });

    const onRecordMetric = () => runAction("recordMetric", async () => recordMetric({
        id: form.id.trim(),
        reporter: form.reporter.trim(),
        metricName: form.metricName.trim(),
        value: form.value.trim(),
        category: form.category.trim(),
        timestamp: form.timestamp.trim(),
    }));

    const onUpdateMetric = () => runAction("updateMetric", async () => updateMetric({
        id: form.id.trim(),
        reporter: form.reporter.trim(),
        newValue: form.newValue.trim(),
        timestamp: form.timestamp.trim(),
    }));

    const onRecordEvent = () => runAction("recordEvent", async () => recordEvent({
        id: form.id.trim(),
        reporter: form.reporter.trim(),
        eventType: form.eventType.trim(),
        description: form.description.trim(),
        timestamp: form.timestamp.trim(),
    }));

    const onGetMetric = () => runAction("getMetric", async () => getMetric(form.id.trim()));
    const onListMetrics = () => runAction("listMetrics", async () => listMetrics());
    const onGetCategoryTotal = () => runAction("getCategoryTotal", async () => {
        const total = await getCategoryTotal(form.category.trim());
        return { category: form.category.trim(), total };
    });
    const onGetCount = () => runAction("getCount", async () => {
        const value = await getMetricCount();
        setCountValue(String(value));
        return { count: value };
    });

    const statusClass = status === "success" ? "output-success" : status === "error" ? "output-error" : "output-idle";

    return (
        <main className="app">
            {/* Wallet Bar */}
            <nav className="wallet-bar">
                <div className="wallet-status">
                    <span className={`status-dot ${walletState ? "connected" : "disconnected"}`} />
                    <span className="wallet-text" id="walletState">
                        {walletState ? truncateAddress(walletState) : "Not Connected"}
                    </span>
                    <span className={`wallet-badge ${walletState ? "badge-connected" : "badge-disconnected"}`}>
                        {walletState ? "Connected" : "Not Connected"}
                    </span>
                </div>
                <button
                    type="button"
                    className={`connect-btn ${loadingAction === "connect" ? "btn-loading" : ""}`}
                    id="connectWallet"
                    onClick={onConnect}
                    disabled={isBusy}
                >
                    Connect Freighter
                </button>
            </nav>

            {/* Hero */}
            <section className="hero">
                <span className="hero-icon">{"\u{1F4CA}"}</span>
                <h1>Dashboard &amp; Analytics</h1>
                <p className="subtitle">Record metrics, track events, and query analytics data on-chain.</p>
                <span className="count-chip">Metrics Tracked: {countValue}</span>
            </section>

            {/* Dashboard Layout */}
            <div className="dashboard-layout">
                {/* Main Column */}
                <div className="main-col">
                    {/* Record Metric Card */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-icon">{"\u{1F4C8}"}</span>
                            <h2>Record Metric</h2>
                        </div>

                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="metricId">Metric ID</label>
                                <input id="metricId" name="id" value={form.id} onChange={setField} />
                                <span className="helper">Unique identifier for this metric</span>
                            </div>
                            <div className="field">
                                <label htmlFor="reporter">Reporter Address</label>
                                <input id="reporter" name="reporter" value={form.reporter} onChange={setField} placeholder="G..." />
                                <span className="helper">Auto-filled on wallet connect</span>
                            </div>
                            <div className="field">
                                <label htmlFor="metricName">Metric Name</label>
                                <input id="metricName" name="metricName" value={form.metricName} onChange={setField} />
                                <span className="helper">e.g., page_views, signups, revenue</span>
                            </div>
                            <div className="field">
                                <label htmlFor="value">Value (i128)</label>
                                <input id="value" name="value" value={form.value} onChange={setField} type="number" />
                                <span className="helper">Numeric value to record</span>
                            </div>
                            <div className="field">
                                <label htmlFor="category">Category</label>
                                <input id="category" name="category" value={form.category} onChange={setField} />
                                <span className="helper">Group metrics by category</span>
                            </div>
                            <div className="field">
                                <label htmlFor="timestamp">Timestamp (u64)</label>
                                <input id="timestamp" name="timestamp" value={form.timestamp} onChange={setField} type="number" />
                                <span className="helper">Unix timestamp for the metric</span>
                            </div>
                        </div>

                        <div className="actions">
                            <button
                                type="button"
                                className={`btn-violet ${loadingAction === "recordMetric" ? "btn-loading" : ""}`}
                                onClick={onRecordMetric}
                                disabled={isBusy}
                            >
                                Record Metric
                            </button>
                        </div>

                        {/* Update inline */}
                        <div style={{ marginTop: "1rem", paddingTop: "0.8rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="field-grid">
                                <div className="field">
                                    <label htmlFor="newValue">New Value (i128)</label>
                                    <input id="newValue" name="newValue" value={form.newValue} onChange={setField} type="number" />
                                    <span className="helper">Updated value to overwrite the existing metric</span>
                                </div>
                            </div>
                            <div className="actions">
                                <button
                                    type="button"
                                    className={`btn-pink ${loadingAction === "updateMetric" ? "btn-loading" : ""}`}
                                    onClick={onUpdateMetric}
                                    disabled={isBusy}
                                >
                                    Update Metric
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Record Event Card */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-icon">{"\u{1F4DD}"}</span>
                            <h2>Record Event</h2>
                        </div>

                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="eventType">Event Type</label>
                                <input id="eventType" name="eventType" value={form.eventType} onChange={setField} />
                                <span className="helper">e.g., info, warning, error</span>
                            </div>
                            <div className="field span-full">
                                <label htmlFor="description">Description</label>
                                <textarea id="description" name="description" rows="3" value={form.description} onChange={setField} />
                                <span className="helper">Describe what happened in this event</span>
                            </div>
                        </div>

                        <div className="actions">
                            <button
                                type="button"
                                className={`btn-pink ${loadingAction === "recordEvent" ? "btn-loading" : ""}`}
                                onClick={onRecordEvent}
                                disabled={isBusy}
                            >
                                Record Event
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sidebar Column — Analytics Queries */}
                <div className="sidebar-col">
                    <div className="card">
                        <div className="card-header">
                            <span className="card-icon">{"\u{1F50D}"}</span>
                            <h2>Analytics Queries</h2>
                        </div>

                        <div className="query-actions">
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "getMetric" ? "btn-loading" : ""}`}
                                onClick={onGetMetric}
                                disabled={isBusy}
                            >
                                Get Metric
                            </button>
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "listMetrics" ? "btn-loading" : ""}`}
                                onClick={onListMetrics}
                                disabled={isBusy}
                            >
                                List All Metrics
                            </button>
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "getCategoryTotal" ? "btn-loading" : ""}`}
                                onClick={onGetCategoryTotal}
                                disabled={isBusy}
                            >
                                Category Total
                            </button>
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "getCount" ? "btn-loading" : ""}`}
                                onClick={onGetCount}
                                disabled={isBusy}
                            >
                                Get Metric Count
                            </button>
                        </div>
                    </div>

                    {/* Data Feed */}
                    <div className="data-feed">
                        <h2>{"\u{1F4E1}"} Data Feed</h2>
                        <pre id="output" className={statusClass}>
                            {output || "Connect your wallet and perform an action to see results here."}
                        </pre>
                    </div>
                </div>
            </div>
        </main>
    );
}
