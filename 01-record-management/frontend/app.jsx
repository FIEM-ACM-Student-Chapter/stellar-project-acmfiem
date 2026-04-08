import React, { useState, useRef, useCallback } from "react";
import { checkConnection, createRecord, updateRecord, archiveRecord, getRecord, listRecords, getRecordsByCategory, getCount } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const initialForm = () => ({
    id: "rec1",
    owner: "",
    title: "Sample Record",
    category: "general",
    description: "A new record entry",
    createdAt: String(nowTs()),
    updatedAt: String(nowTs()),
    filterCategory: "general",
});

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
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
    const [activeTab, setActiveTab] = useState("details");
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
            setForm(prev => ({ ...prev, owner: user.publicKey }));
        }
        return next;
    }, "connect");

    const onCreate = () => runAction(async () => createRecord({
        id: form.id.trim(),
        owner: form.owner.trim(),
        title: form.title.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        createdAt: Number(form.createdAt || nowTs()),
    }), "create");

    const onUpdate = () => runAction(async () => updateRecord({
        id: form.id.trim(),
        owner: form.owner.trim(),
        title: form.title.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        updatedAt: Number(form.updatedAt || nowTs()),
    }), "update");

    const handleArchive = useCallback(() => {
        if (confirmAction === "archive") {
            clearTimeout(confirmTimer.current);
            setConfirmAction(null);
            runAction(async () => archiveRecord({
                id: form.id.trim(),
                owner: form.owner.trim(),
            }), "archive");
        } else {
            setConfirmAction("archive");
            confirmTimer.current = setTimeout(() => setConfirmAction(null), 3000);
        }
    }, [confirmAction, form.id, form.owner]);

    const onGet = () => runAction(async () => getRecord(form.id.trim()), "get");

    const onList = () => runAction(async () => listRecords(), "list");

    const onFilterByCategory = () => runAction(async () => getRecordsByCategory(form.filterCategory.trim()), "filter");

    const onCount = () => runAction(async () => {
        const value = await getCount();
        setCountValue(String(value));
        return { count: value };
    }, "count");

    const isConnected = walletKey.length > 0;

    const btnClass = (actionName, extra = "") => {
        let cls = `btn ${extra}`;
        if (isBusy && busyAction === actionName) cls += " btn-loading";
        return cls.trim();
    };

    const outputClass = () => {
        if (status === "success") return "output-success";
        if (status === "error") return "output-error";
        return "output-idle";
    };

    return (
        <main className="app">
            {/* Wallet Status Bar */}
            <div className="wallet-bar">
                <div className="wallet-info">
                    <button type="button" className={btnClass("connect", "connect-btn")} id="connectWallet" onClick={onConnect} disabled={isBusy}>
                        {isBusy && busyAction === "connect" ? "Connecting..." : "Connect Freighter"}
                    </button>
                    <span className={`wallet-status ${isConnected ? "connected" : ""}`} id="walletState">
                        <span className={`status-dot ${isConnected ? "connected" : "disconnected"}`}></span>
                        {isConnected ? `${truncateAddress(walletKey)} - Connected` : "Not Connected"}
                    </span>
                </div>
                <span className="record-count">Records: {countValue}</span>
            </div>

            {/* Hero Section */}
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 1</p>
                <div className="hero-title">
                    <h1>Record Management System</h1>
                </div>
                <p className="subtitle">
                    Create, update, archive, and search records by category on the Stellar blockchain.
                </p>
            </section>

            {/* Tab Navigation */}
            <div className="tab-nav">
                <button className={`tab-btn ${activeTab === "details" ? "active" : ""}`} onClick={() => setActiveTab("details")}>Record Details</button>
                <button className={`tab-btn ${activeTab === "filter" ? "active" : ""}`} onClick={() => setActiveTab("filter")}>Filter</button>
                <button className={`tab-btn ${activeTab === "actions" ? "active" : ""}`} onClick={() => setActiveTab("actions")}>Actions</button>
            </div>

            {/* Main Content Grid */}
            <div className="content-area">
                {/* Record Details Card */}
                {activeTab === "details" && (
                    <div className="card full-width">
                        <div className="card-header details">
                            <h2>Record Details</h2>
                        </div>
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="entryId">Record ID (Symbol, &lt;= 32 chars)</label>
                                <input id="entryId" name="id" value={form.id} onChange={setField} />
                                <span className="helper">Unique identifier, max 32 characters</span>
                            </div>
                            <div className="field">
                                <label htmlFor="owner">Owner Address</label>
                                <input id="owner" name="owner" value={form.owner} onChange={setField} placeholder="G..." />
                                <span className="helper">Stellar public key starting with G...</span>
                            </div>
                            <div className="field">
                                <label htmlFor="title">Title</label>
                                <input id="title" name="title" value={form.title} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="category">Category (Symbol)</label>
                                <input id="category" name="category" value={form.category} onChange={setField} placeholder="general, finance, legal..." />
                            </div>
                            <div className="field full-width">
                                <label htmlFor="description">Description</label>
                                <textarea id="description" name="description" rows="3" value={form.description} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="createdAt">Created At (u64 timestamp)</label>
                                <input id="createdAt" name="createdAt" value={form.createdAt} onChange={setField} type="number" />
                                <span className="helper">Unix timestamp in seconds</span>
                            </div>
                            <div className="field">
                                <label htmlFor="updatedAt">Updated At (u64 timestamp)</label>
                                <input id="updatedAt" name="updatedAt" value={form.updatedAt} onChange={setField} type="number" />
                                <span className="helper">Unix timestamp in seconds</span>
                            </div>
                        </div>
                        <div className="actions-bar" style={{ marginTop: "1.25rem" }}>
                            <button type="button" className={btnClass("create", "btn-primary")} onClick={onCreate} disabled={isBusy}>
                                {isBusy && busyAction === "create" ? "Processing..." : "Create Record"}
                            </button>
                            <button type="button" className={btnClass("update", "btn-secondary")} onClick={onUpdate} disabled={isBusy}>
                                {isBusy && busyAction === "update" ? "Processing..." : "Update Record"}
                            </button>
                            <button
                                type="button"
                                className={`${btnClass("archive", "btn-destructive")} ${confirmAction === "archive" ? "btn-confirm" : ""}`}
                                onClick={handleArchive}
                                disabled={isBusy}
                            >
                                {confirmAction === "archive" ? "Confirm Archive?" : isBusy && busyAction === "archive" ? "Processing..." : "Archive Record"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Category Filter Card */}
                {activeTab === "filter" && (
                    <div className="card full-width">
                        <div className="card-header category">
                            <h2>Filter by Category</h2>
                        </div>
                        <div className="field">
                            <label htmlFor="filterCategory">Category</label>
                            <input id="filterCategory" name="filterCategory" value={form.filterCategory} onChange={setField} placeholder="general" />
                        </div>
                        <div className="actions-bar">
                            <button type="button" className={btnClass("filter", "btn btn-accent")} onClick={onFilterByCategory} disabled={isBusy}>
                                {isBusy && busyAction === "filter" ? "Processing..." : "Search by Category"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Actions Card */}
                {activeTab === "actions" && (
                    <div className="card full-width">
                        <div className="card-header actions-header">
                            <h2>Query Actions</h2>
                        </div>
                        <div className="query-bar">
                            <button type="button" className={btnClass("get", "btn-ghost")} onClick={onGet} disabled={isBusy}>
                                {isBusy && busyAction === "get" ? "Processing..." : "Get Record"}
                            </button>
                            <button type="button" className={btnClass("list", "btn-ghost")} onClick={onList} disabled={isBusy}>
                                {isBusy && busyAction === "list" ? "Processing..." : "List All Records"}
                            </button>
                            <button type="button" className={btnClass("count", "btn-ghost")} onClick={onCount} disabled={isBusy}>
                                {isBusy && busyAction === "count" ? "Processing..." : "Get Count"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Output Console */}
                <div className="card full-width" style={{ padding: 0 }}>
                    <div className={`output-console ${outputClass()}`}>
                        <div className="console-header">
                            <div className="console-dots">
                                <span></span><span></span><span></span>
                            </div>
                            Output Console
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
            </div>
        </main>
    );
}
