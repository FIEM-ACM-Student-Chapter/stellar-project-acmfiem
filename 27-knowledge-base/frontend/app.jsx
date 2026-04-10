import React, { useState, useRef, useEffect } from "react";
import { checkConnection, createArticle, editArticle, upvoteArticle, markAnswer, archiveArticle, getArticle, listArticles, getArticleCount } from "../lib.js/stellar.js";

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const truncateAddress = (addr) => {
    if (!addr || addr.length < 12) return addr;
    return addr.slice(0, 6) + "..." + addr.slice(-4);
};

export default function App() {
    const [form, setForm] = useState({
        id: "article1",
        author: "",
        title: "Getting Started with Soroban",
        content: "Soroban is a smart contracts platform...",
        category: "tutorial",
        tags: "soroban,stellar,rust",
        editor: "",
        newContent: "",
        voter: "",
    });
    const [output, setOutput] = useState("");
    const [walletState, setWalletState] = useState("Wallet: not connected");
    const [isBusy, setIsBusy] = useState(false);
    const [countValue, setCountValue] = useState("-");
    const [loadingAction, setLoadingAction] = useState(null);
    const [status, setStatus] = useState("idle");
    const [activeTab, setActiveTab] = useState(0);
    const [connectedAddress, setConnectedAddress] = useState("");
    const [confirmAction, setConfirmAction] = useState(null);
    const confirmTimer = useRef(null);

    useEffect(() => {
        return () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); };
    }, []);

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

    const handleConfirm = (actionName, action) => {
        if (confirmAction === actionName) {
            setConfirmAction(null);
            if (confirmTimer.current) clearTimeout(confirmTimer.current);
            action();
        } else {
            setConfirmAction(actionName);
            if (confirmTimer.current) clearTimeout(confirmTimer.current);
            confirmTimer.current = setTimeout(() => setConfirmAction(null), 3000);
        }
    };

    const onConnect = () => runAction("connect", async () => {
        const user = await checkConnection();
        const nextWalletState = user ? `Wallet: ${user.publicKey}` : "Wallet: not connected";
        setWalletState(nextWalletState);
        if (user) {
            setConnectedAddress(user.publicKey);
            setForm((prev) => ({
                ...prev,
                author: prev.author || user.publicKey,
                editor: prev.editor || user.publicKey,
                voter: prev.voter || user.publicKey,
            }));
        }
        return nextWalletState;
    });

    const onCreateArticle = () => runAction("createArticle", async () => createArticle({
        id: form.id.trim(),
        author: form.author.trim(),
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category.trim(),
        tags: form.tags.trim(),
    }));

    const onEditArticle = () => runAction("editArticle", async () => editArticle({
        id: form.id.trim(),
        editor: form.editor.trim() || form.author.trim(),
        newContent: form.newContent.trim(),
    }));

    const onUpvote = () => runAction("upvote", async () => upvoteArticle({
        id: form.id.trim(),
        voter: form.voter.trim() || form.author.trim(),
    }));

    const onMarkAnswer = () => runAction("markAnswer", async () => markAnswer({
        id: form.id.trim(),
        author: form.author.trim(),
    }));

    const onArchive = () => handleConfirm("archive", () => runAction("archive", async () => archiveArticle({
        id: form.id.trim(),
        author: form.author.trim(),
    })));

    const onGetArticle = () => runAction("getArticle", async () => getArticle(form.id.trim()));

    const onList = () => runAction("list", async () => listArticles());

    const onCount = () => runAction("count", async () => {
        const value = await getArticleCount();
        setCountValue(String(value));
        return { count: value };
    });

    const tabs = ["Write Article", "Edit & Collaborate", "Browse"];

    return (
        <main className="app">
            {/* ---- Wallet Status Bar ---- */}
            <div className="wallet-status-bar">
                <span className={`wallet-dot ${connectedAddress ? "connected" : ""}`} />
                <span className="wallet-status-text">
                    {connectedAddress ? truncateAddress(connectedAddress) : "Not connected"}
                </span>
            </div>

            {/* ---- Masthead ---- */}
            <section className="hero">
                <div className="hero-top">
                    <span className="hero-icon">&#128214;</span>
                    <span className="kicker">Stellar Soroban Project 29</span>
                </div>
                <h1>Knowledge Base</h1>
                <p className="subtitle">Create, edit, and curate community knowledge articles on-chain.</p>

                <div className="wallet-bar">
                    <button type="button" id="connectWallet" onClick={onConnect} className={loadingAction === "connect" ? "btn-loading" : ""} disabled={isBusy}>
                        Connect Freighter
                    </button>
                    <span className="wallet-text" id="walletState">{walletState}</span>
                </div>

                <p className="article-count">
                    Articles published: <span className="badge">{countValue}</span>
                </p>
            </section>

            {/* ---- Tab Navigation ---- */}
            <div className="tab-bar">
                {tabs.map((tab, i) => (
                    <button
                        key={tab}
                        type="button"
                        className={`tab-btn ${activeTab === i ? "active" : ""}`}
                        onClick={() => setActiveTab(i)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* ---- Tab 0: Write Article ---- */}
            {activeTab === 0 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#9997;</span>
                        <h2>Write Article</h2>
                    </div>
                    <div className="card-body">
                        <div className="form-grid">
                            <div className="field">
                                <label htmlFor="id">Article ID (Symbol)</label>
                                <input id="id" name="id" value={form.id} onChange={setField} />
                                <span className="field-helper">Unique identifier for this article</span>
                            </div>
                            <div className="field">
                                <label htmlFor="author">Author Address</label>
                                <input id="author" name="author" value={form.author} onChange={setField} placeholder="G..." />
                                <span className="field-helper">Auto-filled when wallet is connected</span>
                            </div>
                            <div className="field full-width">
                                <label htmlFor="title">Title</label>
                                <input id="title" name="title" value={form.title} onChange={setField} />
                            </div>
                            <div className="field full-width">
                                <label htmlFor="content">Content</label>
                                <textarea id="content" name="content" rows="4" value={form.content} onChange={setField} />
                                <span className="field-helper">The full article body stored on-chain</span>
                            </div>
                            <div className="field">
                                <label htmlFor="category">Category (Symbol)</label>
                                <input id="category" name="category" value={form.category} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="tags">Tags (comma-separated)</label>
                                <input id="tags" name="tags" value={form.tags} onChange={setField} />
                                <span className="field-helper">e.g. soroban,stellar,rust</span>
                            </div>
                        </div>

                        <div className="actions">
                            <button type="button" className={`btn ${loadingAction === "createArticle" ? "btn-loading" : ""}`} onClick={onCreateArticle} disabled={isBusy}>Create Article</button>
                        </div>
                    </div>
                </section>
            )}

            {/* ---- Tab 1: Edit & Collaborate ---- */}
            {activeTab === 1 && (
                <>
                    <section className="card">
                        <div className="card-header">
                            <span className="card-icon">&#128221;</span>
                            <h2>Edit &amp; Collaborate</h2>
                        </div>
                        <div className="card-body">
                            <div className="form-grid">
                                <div className="field">
                                    <label htmlFor="editor">Editor Address (optional)</label>
                                    <input id="editor" name="editor" value={form.editor} onChange={setField} placeholder="G..." />
                                    <span className="field-helper">Defaults to author if left blank</span>
                                </div>
                                <div className="field">
                                    <label htmlFor="voter">Voter Address (optional)</label>
                                    <input id="voter" name="voter" value={form.voter} onChange={setField} placeholder="G..." />
                                </div>
                                <div className="field full-width">
                                    <label htmlFor="newContent">New Content (for editing)</label>
                                    <textarea id="newContent" name="newContent" rows="3" value={form.newContent} onChange={setField} />
                                </div>
                            </div>

                            <div className="actions">
                                <button type="button" className={`btn ${loadingAction === "editArticle" ? "btn-loading" : ""}`} onClick={onEditArticle} disabled={isBusy}>Edit Article</button>
                                <button type="button" className={`btn btn-outline ${loadingAction === "upvote" ? "btn-loading" : ""}`} onClick={onUpvote} disabled={isBusy}>&#9650; Upvote</button>
                            </div>
                        </div>
                    </section>

                    <section className="card">
                        <div className="card-header">
                            <span className="card-icon">&#127942;</span>
                            <h2>Curation</h2>
                        </div>
                        <div className="card-body">
                            <div className="actions">
                                <button type="button" className={`btn ${loadingAction === "markAnswer" ? "btn-loading" : ""}`} onClick={onMarkAnswer} disabled={isBusy}>Mark as Answer</button>
                                <button
                                    type="button"
                                    className={`btn btn-danger ${loadingAction === "archive" ? "btn-loading" : ""}`}
                                    onClick={onArchive}
                                    disabled={isBusy}
                                >
                                    {confirmAction === "archive" ? "Confirm Archive?" : "Archive Article"}
                                </button>
                            </div>
                        </div>
                    </section>
                </>
            )}

            {/* ---- Tab 2: Browse ---- */}
            {activeTab === 2 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#128270;</span>
                        <h2>Knowledge Feed</h2>
                    </div>
                    <div className="card-body">
                        <div className="actions">
                            <button type="button" className={`btn btn-ghost ${loadingAction === "getArticle" ? "btn-loading" : ""}`} onClick={onGetArticle} disabled={isBusy}>Get Article</button>
                            <button type="button" className={`btn btn-ghost ${loadingAction === "list" ? "btn-loading" : ""}`} onClick={onList} disabled={isBusy}>List Articles</button>
                            <button type="button" className={`btn btn-ghost ${loadingAction === "count" ? "btn-loading" : ""}`} onClick={onCount} disabled={isBusy}>Get Count</button>
                        </div>
                    </div>
                </section>
            )}

            {/* ---- Output ---- */}
            <section className="card output-card">
                <div className="card-header">
                    <span className="card-icon">&#128195;</span>
                    <h2>Result</h2>
                </div>
                <div className="card-body">
                    <pre id="output" className={`output-pre status-${status}`}>
                        {output || "Connect your wallet and start writing articles. Query results will appear here."}
                    </pre>
                </div>
            </section>
        </main>
    );
}
