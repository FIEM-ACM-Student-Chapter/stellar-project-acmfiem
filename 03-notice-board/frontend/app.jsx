import React, { useState, useRef, useCallback } from "react";
import { checkConnection, postNotice, editNotice, removeNotice, pinNotice, getNotice, listNotices, getNoticeCount } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const initialForm = () => ({
    id: "notice1",
    author: "",
    title: "Important Announcement",
    content: "This is a public notice posted on the blockchain.",
    category: "general",
    priority: "1",
    expiresAt: String(nowTs() + 86400 * 7),
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
    const [activeTab, setActiveTab] = useState("post");
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
            setForm(prev => ({ ...prev, author: user.publicKey }));
        }
        return next;
    }, "connect");

    const onPost = () => runAction(async () => postNotice({
        id: form.id.trim(),
        author: form.author.trim(),
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category.trim(),
        priority: form.priority.trim(),
        expiresAt: Number(form.expiresAt || nowTs() + 86400),
    }), "post");

    const onEdit = () => runAction(async () => editNotice({
        id: form.id.trim(),
        author: form.author.trim(),
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category.trim(),
        priority: form.priority.trim(),
    }), "edit");

    const handleRemove = useCallback(() => {
        if (confirmAction === "remove") {
            clearTimeout(confirmTimer.current);
            setConfirmAction(null);
            runAction(async () => removeNotice({
                id: form.id.trim(),
                author: form.author.trim(),
            }), "remove");
        } else {
            setConfirmAction("remove");
            confirmTimer.current = setTimeout(() => setConfirmAction(null), 3000);
        }
    }, [confirmAction, form.id, form.author]);

    const onPin = () => runAction(async () => pinNotice({
        id: form.id.trim(),
        author: form.author.trim(),
    }), "pin");

    const onGet = () => runAction(async () => getNotice(form.id.trim()), "get");

    const onList = () => runAction(async () => listNotices(), "list");

    const onCount = () => runAction(async () => {
        const value = await getNoticeCount();
        setCountValue(String(value));
        return { count: value };
    }, "count");

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
            {/* Board Header with Pushpin Decorations */}
            <div className="board-header">
                <p className="kicker">Stellar Soroban Project 3</p>
                <h1>Public Notice Board</h1>
                <p className="subtitle">
                    Post announcements, pin important notices, edit content, and manage a decentralized bulletin board.
                </p>
            </div>

            {/* Wallet Strip */}
            <div className="wallet-strip">
                <div className="wallet-info">
                    <button type="button" className={btnCls("connect", "connect-btn")} id="connectWallet" onClick={onConnect} disabled={isBusy}>
                        {btnLoadingText("connect", "Connect Freighter")}
                    </button>
                    <span className="wallet-status" id="walletState">
                        <span className={`status-dot ${isConnected ? "connected" : "disconnected"}`}></span>
                        {isConnected ? `${truncateAddress(walletKey)} - Connected` : "Not Connected"}
                    </span>
                </div>
                <span className="notice-count">Notices: {countValue}</span>
            </div>

            {/* Tab Navigation */}
            <div className="tab-nav">
                <button className={`tab-btn ${activeTab === "post" ? "active" : ""}`} onClick={() => setActiveTab("post")}>Post Notice</button>
                <button className={`tab-btn ${activeTab === "actions" ? "active" : ""}`} onClick={() => setActiveTab("actions")}>Actions</button>
                <button className={`tab-btn ${activeTab === "query" ? "active" : ""}`} onClick={() => setActiveTab("query")}>Query</button>
            </div>

            {/* Cork Board Surface */}
            <div className="cork-surface">
                <div className="board-layout">

                    {/* Post Notice — Paper Note */}
                    {activeTab === "post" && (
                        <div className="note-card full-width-note">
                            <div className="note-card-header post-header">
                                <h2>Post Notice</h2>
                            </div>

                            <div className="paper-fields-grid">
                                <div className="paper-field">
                                    <label htmlFor="entryId">Notice ID (Symbol, &lt;= 32 chars)</label>
                                    <input id="entryId" name="id" value={form.id} onChange={setField} />
                                    <span className="helper">Unique identifier, max 32 characters</span>
                                </div>
                                <div className="paper-field">
                                    <label htmlFor="author">Author Address</label>
                                    <input id="author" name="author" value={form.author} onChange={setField} placeholder="G..." />
                                    <span className="helper">Stellar public key starting with G...</span>
                                </div>
                                <div className="paper-field">
                                    <label htmlFor="title">Title</label>
                                    <input id="title" name="title" value={form.title} onChange={setField} />
                                </div>
                                <div className="paper-field">
                                    <label htmlFor="category">Category (Symbol)</label>
                                    <input id="category" name="category" value={form.category} onChange={setField} placeholder="general, urgent, event..." />
                                </div>
                            </div>
                            <div className="paper-field">
                                <label htmlFor="content">Content</label>
                                <textarea id="content" name="content" rows="4" value={form.content} onChange={setField} />
                            </div>
                            <div className="paper-fields-grid">
                                <div className="paper-field">
                                    <label htmlFor="priority">Priority (0=low, 1=normal, 2=high, 3=critical)</label>
                                    <input id="priority" name="priority" value={form.priority} onChange={setField} type="number" min="0" max="3" />
                                </div>
                                <div className="paper-field">
                                    <label htmlFor="expiresAt">Expires At (u64 timestamp)</label>
                                    <input id="expiresAt" name="expiresAt" value={form.expiresAt} onChange={setField} type="number" />
                                    <span className="helper">Unix timestamp in seconds</span>
                                </div>
                            </div>

                            <div className="note-actions">
                                <button type="button" className={btnCls("post", "btn-note btn-post")} onClick={onPost} disabled={isBusy}>
                                    {btnLoadingText("post", "Post Notice")}
                                </button>
                                <button type="button" className={btnCls("edit", "btn-note btn-secondary-note")} onClick={onEdit} disabled={isBusy}>
                                    {btnLoadingText("edit", "Edit Notice")}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Notice Actions — Paper Note */}
                    {activeTab === "actions" && (
                        <div className="note-card full-width-note">
                            <div className="note-card-header action-header">
                                <h2>Notice Actions</h2>
                            </div>

                            <div className="note-actions" style={{ marginTop: 0, flexDirection: "column" }}>
                                <button type="button" className={btnCls("pin", "btn-note btn-pin")} onClick={onPin} disabled={isBusy}>
                                    {btnLoadingText("pin", "Pin / Unpin")}
                                </button>
                                <button
                                    type="button"
                                    className={`${btnCls("remove", "btn-note btn-remove")} ${confirmAction === "remove" ? "btn-confirm" : ""}`}
                                    onClick={handleRemove}
                                    disabled={isBusy}
                                >
                                    {confirmAction === "remove" ? "Confirm Remove?" : btnLoadingText("remove", "Remove Notice")}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Query Actions */}
                    {activeTab === "query" && (
                        <div className="note-card full-width-note">
                            <div className="note-card-header action-header">
                                <h2>Query Notices</h2>
                            </div>
                            <div className="note-actions" style={{ marginTop: 0, flexDirection: "column" }}>
                                <button type="button" className={btnCls("get", "btn-note btn-ghost-note")} onClick={onGet} disabled={isBusy}>
                                    {btnLoadingText("get", "Get Notice")}
                                </button>
                                <button type="button" className={btnCls("list", "btn-note btn-ghost-note")} onClick={onList} disabled={isBusy}>
                                    {btnLoadingText("list", "List All Notices")}
                                </button>
                                <button type="button" className={btnCls("count", "btn-note btn-ghost-note")} onClick={onCount} disabled={isBusy}>
                                    {btnLoadingText("count", "Get Count")}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Output Note */}
                    <div className={`output-note ${outputClass()}`}>
                        <div className="output-note-header">
                            Output
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
