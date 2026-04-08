import React, { useState, useRef, useEffect } from "react";
import { checkConnection, createTicket, assignTicket, addResponse, closeTicket, reopenTicket, getTicket, listTickets, getOpenCount } from "../lib.js/stellar.js";

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const initialForm = () => ({
    id: "tkt1",
    reporter: "",
    admin: "",
    assignee: "",
    responder: "",
    closer: "",
    subject: "Login page returns 500 error",
    description: "Users cannot log in since the latest deployment",
    category: "bug",
    priority: "3",
    message: "",
});

const TABS = ["Create Ticket", "Manage", "Browse"];

export default function App() {
    const [form, setForm] = useState(initialForm);
    const [output, setOutput] = useState("Ready.");
    const [walletState, setWalletState] = useState("Wallet: not connected");
    const [isBusy, setIsBusy] = useState(false);
    const [openCount, setOpenCount] = useState("-");
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
                reporter: prev.reporter || user.publicKey,
                admin: prev.admin || user.publicKey,
                assignee: prev.assignee || user.publicKey,
                responder: prev.responder || user.publicKey,
                closer: prev.closer || user.publicKey,
            }));
        }
        const next = user ? `Wallet: ${user.publicKey}` : "Wallet: not connected";
        setWalletState(next);
        return next;
    }));

    const onCreate = withLoading("create", () => runAction(async () => createTicket({
        id: form.id.trim(),
        reporter: form.reporter.trim(),
        subject: form.subject.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        priority: form.priority.trim(),
    })));

    const onAssign = withLoading("assign", () => runAction(async () => assignTicket({
        id: form.id.trim(),
        admin: form.admin.trim(),
        assignee: form.assignee.trim(),
    })));

    const onRespond = withLoading("respond", () => runAction(async () => addResponse({
        id: form.id.trim(),
        responder: form.responder.trim(),
        message: form.message.trim(),
    })));

    const onClose = handleDestructive("close", withLoading("close", () => runAction(async () => closeTicket({
        id: form.id.trim(),
        closer: form.closer.trim(),
    }))));

    const onReopen = withLoading("reopen", () => runAction(async () => reopenTicket({
        id: form.id.trim(),
        reporter: form.reporter.trim(),
    })));

    const onGet = withLoading("get", () => runAction(async () => getTicket(form.id.trim())));

    const onList = withLoading("list", () => runAction(async () => listTickets()));

    const onOpenCount = withLoading("openCount", () => runAction(async () => {
        const value = await getOpenCount();
        setOpenCount(String(value));
        return { openCount: value };
    }));

    const priorityNum = parseInt(form.priority, 10) || 0;

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
                <span className="open-badge">Open: {openCount}</span>
                <button type="button" className={btnClass("connect")} onClick={onConnect} disabled={isBusy}>
                    {isConnected ? "Reconnect" : "Connect Freighter"}
                </button>
            </div>

            {/* Hero */}
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 19</p>
                <div className="hero-icon">&#128027;</div>
                <h1>Issue Tracker</h1>
                <p className="subtitle">
                    Create tickets, assign agents, track responses, and manage resolution on-chain.
                </p>
            </section>

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

            {/* Tab: Create Ticket */}
            {activeTab === 0 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#128221;</span>
                        <h2>Create Ticket</h2>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="ticketId">Ticket ID</label>
                            <input id="ticketId" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Unique identifier for this ticket</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="reporter">Reporter Address</label>
                            <input id="reporter" name="reporter" value={form.reporter} onChange={setField} placeholder="G..." />
                            <span className="helper">Auto-filled on wallet connect</span>
                        </div>
                        <div className="form-group full">
                            <label htmlFor="subject">Subject</label>
                            <input id="subject" name="subject" value={form.subject} onChange={setField} />
                        </div>
                        <div className="form-group full">
                            <label htmlFor="description">Description</label>
                            <textarea id="description" name="description" rows="3" value={form.description} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="category">Category</label>
                            <input id="category" name="category" value={form.category} onChange={setField} placeholder="bug, feature, question..." />
                            <span className="helper">E.g. bug, feature, question</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="priority">Priority (1-4)</label>
                            <input id="priority" name="priority" value={form.priority} onChange={setField} type="number" min="1" max="5" />
                            <div className="priority-labels">
                                <span className={`priority-label p1 ${priorityNum === 1 ? "active" : ""}`}>P1 Critical</span>
                                <span className={`priority-label p2 ${priorityNum === 2 ? "active" : ""}`}>P2 High</span>
                                <span className={`priority-label p3 ${priorityNum === 3 ? "active" : ""}`}>P3 Medium</span>
                                <span className={`priority-label p4 ${priorityNum >= 4 ? "active" : ""}`}>P4 Low</span>
                            </div>
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className={btnClass("create")} onClick={onCreate} disabled={isBusy}>Create Ticket</button>
                    </div>
                </section>
            )}

            {/* Tab: Manage */}
            {activeTab === 1 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#9874;</span>
                        <h2>Ticket Management</h2>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="mgmtId">Ticket ID</label>
                            <input id="mgmtId" name="id" value={form.id} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="admin">Admin Address</label>
                            <input id="admin" name="admin" value={form.admin} onChange={setField} placeholder="G..." />
                            <span className="helper">Admin who can assign tickets</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="assignee">Assignee Address</label>
                            <input id="assignee" name="assignee" value={form.assignee} onChange={setField} placeholder="G..." />
                            <span className="helper">Person assigned to resolve the ticket</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="responder">Responder Address</label>
                            <input id="responder" name="responder" value={form.responder} onChange={setField} placeholder="G..." />
                        </div>
                        <div className="form-group">
                            <label htmlFor="closer">Closer Address</label>
                            <input id="closer" name="closer" value={form.closer} onChange={setField} placeholder="G..." />
                        </div>
                        <div className="form-group full">
                            <label htmlFor="message">Response Message</label>
                            <textarea id="message" name="message" rows="3" value={form.message} onChange={setField} />
                            <span className="helper">Message to add as a response to the ticket</span>
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className={btnClass("assign")} onClick={onAssign} disabled={isBusy}>Assign</button>
                        <button type="button" className={`btn-secondary ${btnClass("respond")}`} onClick={onRespond} disabled={isBusy}>Respond</button>
                        <button type="button" className={`btn-close-ticket ${btnClass("close")}`} onClick={onClose} disabled={isBusy && loadingAction !== "close"}>
                            {confirmAction === "close" ? "Confirm?" : "Close"}
                        </button>
                        <button type="button" className={`btn-reopen ${btnClass("reopen")}`} onClick={onReopen} disabled={isBusy}>Reopen</button>
                    </div>
                </section>
            )}

            {/* Tab: Browse */}
            {activeTab === 2 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#128200;</span>
                        <h2>Ticket Board</h2>
                    </div>
                    <div className="form-group" style={{ marginBottom: "1rem" }}>
                        <label htmlFor="browseId">Ticket ID</label>
                        <input id="browseId" name="id" value={form.id} onChange={setField} />
                        <span className="helper">Enter a ticket ID to fetch its details</span>
                    </div>
                    <div className="query-row">
                        <button type="button" className={`btn-ghost ${btnClass("get")}`} onClick={onGet} disabled={isBusy}>Get Ticket</button>
                        <button type="button" className={`btn-ghost ${btnClass("list")}`} onClick={onList} disabled={isBusy}>List Tickets</button>
                        <button type="button" className={`btn-ghost ${btnClass("openCount")}`} onClick={onOpenCount} disabled={isBusy}>Open Count</button>
                    </div>
                </section>
            )}

            {/* Activity Stream (Output) */}
            <section className={`output-panel ${status}`}>
                <h2>&#9670; Activity Stream</h2>
                {outputIsEmpty ? (
                    <div className="empty-state">Connect your wallet and perform an action to see results here.</div>
                ) : (
                    <pre id="output">{output}</pre>
                )}
            </section>
        </main>
    );
}
