import React, { useState, useRef, useCallback } from "react";
import { checkConnection, fileComplaint, assignComplaint, resolveComplaint, escalateComplaint, getComplaint, listComplaints, getComplaintCount } from "../lib.js/stellar.js";

const initialForm = () => ({
    id: "case1",
    reporter: "",
    subject: "Service Disruption",
    description: "Detailed description of the complaint or issue.",
    category: "service",
    severity: "1",
    admin: "",
    assignee: "",
    handler: "",
    resolutionNotes: "",
});

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const severityLabel = (val) => {
    const n = Number(val);
    if (n <= 1) return { cls: "severity-1", text: "Low" };
    if (n === 2) return { cls: "severity-2", text: "Medium" };
    if (n === 3) return { cls: "severity-3", text: "High" };
    if (n === 4) return { cls: "severity-4", text: "Critical" };
    return { cls: "severity-5", text: "Urgent" };
};

const truncateAddress = (addr) => {
    if (!addr || addr.length < 12) return addr;
    return addr.slice(0, 8) + "..." + addr.slice(-4);
};

export default function App() {
    const [form, setForm] = useState(initialForm);
    const [output, setOutput] = useState("Ready.");
    const [walletState, setWalletState] = useState("Wallet: not connected");
    const [walletKey, setWalletKey] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [busyAction, setBusyAction] = useState("");
    const [countValue, setCountValue] = useState("-");
    const [status, setStatus] = useState("idle");
    const [activeTab, setActiveTab] = useState("file");
    const [confirmAction, setConfirmAction] = useState(null);
    const confirmTimer = useRef(null);

    const setField = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const runAction = async (action, actionName) => {
        setIsBusy(true);
        setBusyAction(actionName || "");
        try {
            const result = await action();
            setOutput(toOutput(result ?? "No data found"));
            setStatus("success");
        } catch (error) {
            setOutput(error?.message || String(error));
            setStatus("error");
        } finally {
            setIsBusy(false);
            setBusyAction("");
        }
    };

    const onConnect = () => runAction(async () => {
        const user = await checkConnection();
        const next = user ? `Wallet: ${user.publicKey}` : "Wallet: not connected";
        setWalletState(next);
        if (user) {
            setWalletKey(user.publicKey);
            setForm(prev => ({ ...prev, reporter: user.publicKey, admin: user.publicKey, handler: user.publicKey }));
        }
        return next;
    }, "connect");

    const onFile = () => runAction(async () => fileComplaint({
        id: form.id.trim(),
        reporter: form.reporter.trim(),
        subject: form.subject.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        severity: form.severity.trim(),
    }), "file");

    const onAssign = () => runAction(async () => assignComplaint({
        id: form.id.trim(),
        admin: form.admin.trim(),
        assignee: form.assignee.trim(),
    }), "assign");

    const onResolve = () => runAction(async () => resolveComplaint({
        id: form.id.trim(),
        handler: form.handler.trim(),
        resolutionNotes: form.resolutionNotes.trim(),
    }), "resolve");

    const handleEscalate = useCallback(() => {
        if (confirmAction === "escalate") {
            clearTimeout(confirmTimer.current);
            setConfirmAction(null);
            runAction(async () => escalateComplaint({
                id: form.id.trim(),
                reporter: form.reporter.trim(),
            }), "escalate");
        } else {
            setConfirmAction("escalate");
            confirmTimer.current = setTimeout(() => setConfirmAction(null), 3000);
        }
    }, [confirmAction, form.id, form.reporter]);

    const onGet = () => runAction(async () => getComplaint(form.id.trim()), "get");

    const onList = () => runAction(async () => listComplaints(), "list");

    const onCount = () => runAction(async () => {
        const value = await getComplaintCount();
        setCountValue(String(value));
        return { count: value };
    }, "count");

    const sev = severityLabel(form.severity);
    const isConnected = walletKey.length > 0;

    const btnLoadingText = (actionName, label) => {
        if (isBusy && busyAction === actionName) return "Processing...";
        return label;
    };

    const btnCls = (actionName, base) => {
        let cls = base;
        if (isBusy && busyAction === actionName) cls += " btn-loading";
        return cls;
    };

    const outputClass = () => {
        if (status === "success") return "output-success";
        if (status === "error") return "output-error";
        return "output-idle";
    };

    return (
        <main className="app">
            {/* Alert Banner / Hero */}
            <div className="alert-banner">
                <p className="kicker">Stellar Soroban Project 5</p>
                <h1>Complaint / Issue Reporting</h1>
                <p className="subtitle">
                    File complaints, assign handlers, escalate issues, and track resolutions on the Stellar blockchain.
                </p>
            </div>

            {/* Info Bar */}
            <div className="info-bar">
                <div className="info-left">
                    <button type="button" className={btnCls("connect", "connect-btn")} id="connectWallet" onClick={onConnect} disabled={isBusy}>
                        {btnLoadingText("connect", "Connect Wallet")}
                    </button>
                    <span className="wallet-text" id="walletState">
                        <span className={`status-dot ${isConnected ? "connected" : "disconnected"}`}></span>
                        {isConnected ? `${truncateAddress(walletKey)} - Connected` : "Not Connected"}
                    </span>
                </div>
                <span className="case-count">Cases: {countValue}</span>
            </div>

            {/* Tab Navigation */}
            <div className="tab-nav">
                <button className={`tab-btn ${activeTab === "file" ? "active" : ""}`} onClick={() => setActiveTab("file")}>File Complaint</button>
                <button className={`tab-btn ${activeTab === "assign" ? "active" : ""}`} onClick={() => setActiveTab("assign")}>Assignment</button>
                <button className={`tab-btn ${activeTab === "resolve" ? "active" : ""}`} onClick={() => setActiveTab("resolve")}>Resolution</button>
                <button className={`tab-btn ${activeTab === "query" ? "active" : ""}`} onClick={() => setActiveTab("query")}>Query</button>
            </div>

            {/* Form Container */}
            <div className="form-container">

                {/* Step 1: File Complaint */}
                {activeTab === "file" && (
                    <div className="step-section">
                        <div className="step-header">
                            <span className="step-number">1</span>
                            <h2>File Complaint</h2>
                        </div>
                        <div className="step-body">
                            <div className="form-row">
                                <div className="official-field">
                                    <label htmlFor="entryId">Complaint ID (Symbol, &lt;= 32 chars)</label>
                                    <input id="entryId" name="id" value={form.id} onChange={setField} />
                                    <span className="helper">Unique identifier, max 32 characters</span>
                                </div>
                                <div className="official-field">
                                    <label htmlFor="reporter">Reporter Address</label>
                                    <input id="reporter" name="reporter" value={form.reporter} onChange={setField} placeholder="G..." />
                                    <span className="helper">Stellar public key starting with G...</span>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="official-field">
                                    <label htmlFor="subject">Subject</label>
                                    <input id="subject" name="subject" value={form.subject} onChange={setField} />
                                </div>
                                <div className="official-field">
                                    <label htmlFor="category">Category (Symbol)</label>
                                    <input id="category" name="category" value={form.category} onChange={setField} placeholder="service, billing, safety..." />
                                </div>
                            </div>
                            <div className="form-row single">
                                <div className="official-field">
                                    <label htmlFor="description">Description</label>
                                    <textarea id="description" name="description" rows="3" value={form.description} onChange={setField} />
                                </div>
                            </div>
                            <div className="severity-row">
                                <div className="official-field">
                                    <label htmlFor="severity">Severity (1-5, where 5 is most severe)</label>
                                    <input id="severity" name="severity" value={form.severity} onChange={setField} type="number" min="1" max="5" />
                                </div>
                                <span className={`severity-badge ${sev.cls}`}>{sev.text}</span>
                            </div>
                            <div className="step-actions">
                                <button type="button" className={btnCls("file", "btn-official btn-file")} onClick={onFile} disabled={isBusy}>
                                    {btnLoadingText("file", "File Complaint")}
                                </button>
                                <button
                                    type="button"
                                    className={`${btnCls("escalate", "btn-official btn-escalate-action")} ${confirmAction === "escalate" ? "btn-confirm" : ""}`}
                                    onClick={handleEscalate}
                                    disabled={isBusy}
                                >
                                    {confirmAction === "escalate" ? "Confirm Escalate?" : btnLoadingText("escalate", "Escalate")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Assignment */}
                {activeTab === "assign" && (
                    <div className="step-section">
                        <div className="step-header">
                            <span className="step-number">2</span>
                            <h2>Assignment</h2>
                        </div>
                        <div className="step-body">
                            <div className="form-row">
                                <div className="official-field">
                                    <label htmlFor="admin">Admin Address (for assignment)</label>
                                    <input id="admin" name="admin" value={form.admin} onChange={setField} placeholder="G..." />
                                    <span className="helper">Stellar public key starting with G...</span>
                                </div>
                                <div className="official-field">
                                    <label htmlFor="assignee">Assignee / Handler Address</label>
                                    <input id="assignee" name="assignee" value={form.assignee} onChange={setField} placeholder="G..." />
                                    <span className="helper">Stellar public key starting with G...</span>
                                </div>
                            </div>
                            <div className="step-actions">
                                <button type="button" className={btnCls("assign", "btn-official btn-assign")} onClick={onAssign} disabled={isBusy}>
                                    {btnLoadingText("assign", "Assign Complaint")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Resolution */}
                {activeTab === "resolve" && (
                    <div className="step-section">
                        <div className="step-header">
                            <span className="step-number">3</span>
                            <h2>Resolution</h2>
                        </div>
                        <div className="step-body">
                            <div className="form-row single">
                                <div className="official-field">
                                    <label htmlFor="handler">Handler Address (for resolution)</label>
                                    <input id="handler" name="handler" value={form.handler} onChange={setField} placeholder="G..." />
                                    <span className="helper">Stellar public key starting with G...</span>
                                </div>
                            </div>
                            <div className="form-row single">
                                <div className="official-field">
                                    <label htmlFor="resolutionNotes">Resolution Notes</label>
                                    <textarea id="resolutionNotes" name="resolutionNotes" rows="3" value={form.resolutionNotes} onChange={setField} />
                                </div>
                            </div>
                            <div className="step-actions">
                                <button type="button" className={btnCls("resolve", "btn-official btn-resolve")} onClick={onResolve} disabled={isBusy}>
                                    {btnLoadingText("resolve", "Resolve Complaint")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Query Tab */}
                {activeTab === "query" && (
                    <div className="step-section">
                        <div className="step-header">
                            <span className="step-number">?</span>
                            <h2>Query Complaints</h2>
                        </div>
                        <div className="step-body">
                            <div className="step-actions" style={{ borderTop: "none", paddingTop: 0 }}>
                                <button type="button" className={btnCls("get", "btn-official btn-ghost-official")} onClick={onGet} disabled={isBusy}>
                                    {btnLoadingText("get", "Get Complaint")}
                                </button>
                                <button type="button" className={btnCls("list", "btn-official btn-ghost-official")} onClick={onList} disabled={isBusy}>
                                    {btnLoadingText("list", "List All")}
                                </button>
                                <button type="button" className={btnCls("count", "btn-official btn-ghost-official")} onClick={onCount} disabled={isBusy}>
                                    {btnLoadingText("count", "Get Count")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Case Log */}
                <div className={`case-log ${outputClass()}`}>
                    <div className="log-header">
                        <span className="step-number">4</span>
                        Case Log
                    </div>
                    {output === "Ready." ? (
                        <div className="empty-state">
                            <div className="empty-icon">&#9678;</div>
                            <p>Connect your wallet and perform an action to see results here.</p>
                        </div>
                    ) : (
                        <pre id="output">{output}</pre>
                    )}
                </div>
            </div>
        </main>
    );
}
