import React, { useState, useRef, useEffect } from "react";
import { checkConnection, createRequest, acceptRequest, submitWork, approveWork, rejectWork, getRequest, listRequests } from "../lib.js/stellar.js";

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const initialForm = () => ({
    id: "req1",
    requester: "",
    provider: "",
    title: "Fix homepage layout",
    description: "The header overlaps on mobile devices",
    priority: "3",
    category: "bugfix",
    budget: "1000",
    workNotes: "",
    reason: "",
});

const TABS = ["New Request", "Workflow", "Lookup"];

export default function App() {
    const [form, setForm] = useState(initialForm);
    const [output, setOutput] = useState("Ready.");
    const [walletState, setWalletState] = useState("Wallet: not connected");
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [status, setStatus] = useState("idle");
    const [activeTab, setActiveTab] = useState(0);
    const [confirmAction, setConfirmAction] = useState(null);
    const confirmTimer = useRef(null);
    const [connectedAddress, setConnectedAddress] = useState("");

    useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);

    const setField = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const runAction = async (action) => {
        setIsBusy(true);
        try {
            const result = await action();
            setOutput(toOutput(result ?? "No data found"));
            setStatus("success");
        } catch (error) {
            setOutput(error?.message || String(error));
            setStatus("error");
        } finally {
            setIsBusy(false);
        }
    };

    const withLoading = (key, fn) => async () => {
        setLoadingAction(key);
        await fn();
        setLoadingAction(null);
    };

    const handleDestructive = (key, fn) => () => {
        if (confirmAction === key) {
            clearTimeout(confirmTimer.current);
            setConfirmAction(null);
            fn();
        } else {
            setConfirmAction(key);
            confirmTimer.current = setTimeout(() => setConfirmAction(null), 3000);
        }
    };

    const onConnect = withLoading("connect", () => runAction(async () => {
        const user = await checkConnection();
        if (user) {
            setConnectedAddress(user.publicKey);
            setForm((prev) => ({
                ...prev,
                requester: prev.requester || user.publicKey,
                provider: prev.provider || user.publicKey,
            }));
        }
        const next = user ? `Wallet: ${user.publicKey}` : "Wallet: not connected";
        setWalletState(next);
        return next;
    }));

    const onCreate = withLoading("create", () => runAction(async () => createRequest({
        id: form.id.trim(),
        requester: form.requester.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority.trim(),
        category: form.category.trim(),
        budget: form.budget.trim(),
    })));

    const onAccept = withLoading("accept", () => runAction(async () => acceptRequest({
        id: form.id.trim(),
        provider: form.provider.trim(),
    })));

    const onSubmit = withLoading("submit", () => runAction(async () => submitWork({
        id: form.id.trim(),
        provider: form.provider.trim(),
        workNotes: form.workNotes.trim(),
    })));

    const onApprove = withLoading("approve", () => runAction(async () => approveWork({
        id: form.id.trim(),
        requester: form.requester.trim(),
    })));

    const onReject = handleDestructive("reject", withLoading("reject", () => runAction(async () => rejectWork({
        id: form.id.trim(),
        requester: form.requester.trim(),
        reason: form.reason.trim(),
    }))));

    const onGet = withLoading("get", () => runAction(async () => getRequest(form.id.trim())));

    const onList = withLoading("list", () => runAction(async () => listRequests()));

    const isConnected = connectedAddress.length > 0;
    const truncAddr = connectedAddress ? connectedAddress.slice(0, 6) + "..." + connectedAddress.slice(-4) : "";

    const btnClass = (key, extra = "") => {
        let cls = extra;
        if (loadingAction === key) cls += " btn-loading";
        return cls.trim();
    };

    const outputIsEmpty = output === "Ready.";

    return (
        <main className="app">
            {/* Wallet Status Bar */}
            <div className="wallet-status-bar">
                <div className="wallet-status-left">
                    <span className={`status-dot ${isConnected ? "connected" : "disconnected"}`} />
                    {isConnected ? (
                        <>
                            <span className="wallet-addr" title={connectedAddress}>{truncAddr}</span>
                            <span className="connected-badge">Connected</span>
                        </>
                    ) : (
                        <span className="wallet-addr">No wallet connected</span>
                    )}
                </div>
                <button type="button" className={btnClass("connect")} onClick={onConnect} disabled={isBusy}>
                    {isConnected ? "Reconnect" : "Connect Freighter"}
                </button>
            </div>

            {/* Hero */}
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 17</p>
                <div className="hero-icon">&#128295;</div>
                <h1>Service Request System</h1>
                <p className="subtitle">
                    Create work orders, accept jobs, submit deliverables, and manage approvals on-chain.
                </p>
            </section>

            {/* Status Workflow Flow */}
            <div className="status-flow">
                <span className="flow-step active">&#9679; Open</span>
                <span className="flow-arrow">&#8594;</span>
                <span className="flow-step">&#9679; Accepted</span>
                <span className="flow-arrow">&#8594;</span>
                <span className="flow-step">&#9679; Submitted</span>
                <span className="flow-arrow">&#8594;</span>
                <span className="flow-step">&#9679; Approved</span>
            </div>

            {/* Tab Navigation */}
            <nav className="tab-nav">
                {TABS.map((tab, i) => (
                    <button
                        key={tab}
                        type="button"
                        className={`tab-btn ${activeTab === i ? "active" : ""}`}
                        onClick={() => setActiveTab(i)}
                    >
                        {tab}
                    </button>
                ))}
            </nav>

            {/* Tab: New Request */}
            {activeTab === 0 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#128221;</span>
                        <h2>New Service Request</h2>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="reqId">Request ID</label>
                            <input id="reqId" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Unique identifier for this request</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="requester">Requester Address</label>
                            <input id="requester" name="requester" value={form.requester} onChange={setField} placeholder="G..." />
                            <span className="helper">Auto-filled on wallet connect</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="title">Title</label>
                            <input id="title" name="title" value={form.title} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="category">Category</label>
                            <input id="category" name="category" value={form.category} onChange={setField} placeholder="bugfix, feature, support..." />
                            <span className="helper">E.g. bugfix, feature, support</span>
                        </div>
                        <div className="form-group full">
                            <label htmlFor="description">Description</label>
                            <textarea id="description" name="description" rows="3" value={form.description} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="priority">Priority (1-5)</label>
                            <input id="priority" name="priority" value={form.priority} onChange={setField} type="number" min="1" max="5" />
                            <span className="helper">1 = lowest, 5 = critical</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="budget">Budget (i128)</label>
                            <input id="budget" name="budget" value={form.budget} onChange={setField} type="number" />
                            <span className="helper">Payment amount in stroops</span>
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className={btnClass("create")} onClick={onCreate} disabled={isBusy}>Create Request</button>
                    </div>
                </section>
            )}

            {/* Tab: Workflow */}
            {activeTab === 1 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#9881;</span>
                        <h2>Workflow</h2>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="provider">Provider Address</label>
                            <input id="provider" name="provider" value={form.provider} onChange={setField} placeholder="G..." />
                            <span className="helper">The service provider accepting the work</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="wfReqId">Request ID</label>
                            <input id="wfReqId" name="id" value={form.id} onChange={setField} />
                        </div>
                        <div className="form-group full">
                            <label htmlFor="workNotes">Work Notes</label>
                            <textarea id="workNotes" name="workNotes" rows="3" value={form.workNotes} onChange={setField} />
                            <span className="helper">Notes about the completed work</span>
                        </div>
                        <div className="form-group full">
                            <label htmlFor="reason">Rejection Reason</label>
                            <input id="reason" name="reason" value={form.reason} onChange={setField} />
                            <span className="helper">Required if rejecting work</span>
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className={btnClass("accept")} onClick={onAccept} disabled={isBusy}>Accept Request</button>
                        <button type="button" className={`btn-secondary ${btnClass("submit")}`} onClick={onSubmit} disabled={isBusy}>Submit Work</button>
                        <button type="button" className={`btn-green ${btnClass("approve")}`} onClick={onApprove} disabled={isBusy}>Approve Work</button>
                        <button type="button" className={`btn-red ${btnClass("reject")}`} onClick={onReject} disabled={isBusy && loadingAction !== "reject"}>
                            {confirmAction === "reject" ? "Confirm?" : "Reject Work"}
                        </button>
                    </div>
                </section>
            )}

            {/* Tab: Lookup */}
            {activeTab === 2 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#128269;</span>
                        <h2>Request Lookup</h2>
                    </div>
                    <div className="form-group" style={{ marginBottom: "1rem" }}>
                        <label htmlFor="lookupId">Request ID</label>
                        <input id="lookupId" name="id" value={form.id} onChange={setField} />
                        <span className="helper">Enter a request ID to fetch its details</span>
                    </div>
                    <div className="query-row">
                        <button type="button" className={`btn-ghost ${btnClass("get")}`} onClick={onGet} disabled={isBusy}>Get Request</button>
                        <button type="button" className={`btn-ghost ${btnClass("list")}`} onClick={onList} disabled={isBusy}>List Requests</button>
                    </div>
                </section>
            )}

            {/* Work Log (Output) */}
            <section className={`output-panel ${status}`}>
                <h2>&#128203; Work Log</h2>
                {outputIsEmpty ? (
                    <div className="empty-state">Connect your wallet and perform an action to see results here.</div>
                ) : (
                    <pre id="output">{output}</pre>
                )}
            </section>
        </main>
    );
}
