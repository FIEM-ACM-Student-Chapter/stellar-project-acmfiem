import React, { useState, useRef, useEffect } from "react";
import { checkConnection, createPost, likePost, commentPost, flagPost, removePost, getPost, listPosts, getPostCount } from "../lib.js/stellar.js";

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const initialForm = () => ({
    id: "post1",
    author: "",
    content: "Just deployed my first Soroban smart contract!",
    category: "general",
    tags: "stellar, soroban, web3",
    liker: "",
    commenter: "",
    commentText: "",
    flagger: "",
});

const TABS = ["Compose", "Interact", "Feed"];

export default function App() {
    const [form, setForm] = useState(initialForm);
    const [output, setOutput] = useState("Ready.");
    const [walletState, setWalletState] = useState("Wallet: not connected");
    const [isBusy, setIsBusy] = useState(false);
    const [countValue, setCountValue] = useState("-");
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
                author: prev.author || user.publicKey,
                liker: prev.liker || user.publicKey,
                commenter: prev.commenter || user.publicKey,
                flagger: prev.flagger || user.publicKey,
            }));
        }
        const next = user ? `Wallet: ${user.publicKey}` : "Wallet: not connected";
        setWalletState(next);
        return next;
    }));

    const onCreate = withLoading("create", () => runAction(async () => createPost({
        id: form.id.trim(),
        author: form.author.trim(),
        content: form.content.trim(),
        category: form.category.trim(),
        tags: form.tags.trim(),
    })));

    const onLike = withLoading("like", () => runAction(async () => likePost({
        id: form.id.trim(),
        liker: form.liker.trim() || form.author.trim(),
    })));

    const onComment = withLoading("comment", () => runAction(async () => commentPost({
        id: form.id.trim(),
        commenter: form.commenter.trim() || form.author.trim(),
        commentText: form.commentText.trim(),
    })));

    const onFlag = handleDestructive("flag", withLoading("flag", () => runAction(async () => flagPost({
        id: form.id.trim(),
        flagger: form.flagger.trim() || form.author.trim(),
    }))));

    const onRemove = handleDestructive("remove", withLoading("remove", () => runAction(async () => removePost({
        id: form.id.trim(),
        author: form.author.trim(),
    }))));

    const onGet = withLoading("get", () => runAction(async () => getPost(form.id.trim())));

    const onList = withLoading("list", () => runAction(async () => listPosts()));

    const onCount = withLoading("count", () => runAction(async () => {
        const value = await getPostCount();
        setCountValue(String(value));
        return { count: value };
    }));

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
                <span className="post-count">Posts: {countValue}</span>
                <button type="button" className={btnClass("connect")} onClick={onConnect} disabled={isBusy}>
                    {isConnected ? "Reconnect" : "Connect Freighter"}
                </button>
            </div>

            {/* Hero */}
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 20</p>
                <div className="hero-icon">&#128172;</div>
                <h1>Community Platform</h1>
                <p className="subtitle">
                    Share ideas, interact with posts, and build community on the Stellar blockchain.
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

            {/* Tab: Compose */}
            {activeTab === 0 && (
                <section className="compose-box">
                    <div className="compose-header">
                        <div className="compose-avatar">&#9998;</div>
                        <h2>Compose Post</h2>
                    </div>
                    <textarea
                        id="content"
                        name="content"
                        rows="3"
                        value={form.content}
                        onChange={setField}
                        placeholder="What's on your mind?"
                    />
                    <div className="compose-meta">
                        <div className="form-group">
                            <label htmlFor="postId">Post ID</label>
                            <input id="postId" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Unique post identifier</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="author">Author Address</label>
                            <input id="author" name="author" value={form.author} onChange={setField} placeholder="G..." />
                            <span className="helper">Auto-filled on wallet connect</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="category">Category</label>
                            <input id="category" name="category" value={form.category} onChange={setField} placeholder="general, tech, art..." />
                        </div>
                        <div className="form-group">
                            <label htmlFor="tags">Tags</label>
                            <input id="tags" name="tags" value={form.tags} onChange={setField} placeholder="comma-separated" />
                            <span className="helper">Comma-separated list of tags</span>
                        </div>
                    </div>
                    <div className="compose-footer">
                        <button type="button" className={btnClass("create")} onClick={onCreate} disabled={isBusy}>Publish</button>
                    </div>
                </section>
            )}

            {/* Tab: Interact */}
            {activeTab === 1 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#9889;</span>
                        <h2>Interact</h2>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="interactId">Post ID</label>
                            <input id="interactId" name="id" value={form.id} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="liker">Liker Address</label>
                            <input id="liker" name="liker" value={form.liker} onChange={setField} placeholder="G..." />
                            <span className="helper">Defaults to author if empty</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="commenter">Commenter Address</label>
                            <input id="commenter" name="commenter" value={form.commenter} onChange={setField} placeholder="G..." />
                        </div>
                        <div className="form-group">
                            <label htmlFor="flagger">Flagger Address</label>
                            <input id="flagger" name="flagger" value={form.flagger} onChange={setField} placeholder="G..." />
                        </div>
                        <div className="form-group full">
                            <label htmlFor="commentText">Comment</label>
                            <textarea id="commentText" name="commentText" rows="2" value={form.commentText} onChange={setField} />
                            <span className="helper">Add a comment to the selected post</span>
                        </div>
                    </div>
                    <div className="icon-actions">
                        <button type="button" className={`icon-btn like ${btnClass("like")}`} onClick={onLike} disabled={isBusy}>&#10084; Like</button>
                        <button type="button" className={`icon-btn comment ${btnClass("comment")}`} onClick={onComment} disabled={isBusy}>&#128172; Comment</button>
                        <button type="button" className={`icon-btn flag ${btnClass("flag")}`} onClick={onFlag} disabled={isBusy && loadingAction !== "flag"}>
                            {confirmAction === "flag" ? "Confirm?" : "\u26A0 Flag"}
                        </button>
                        <button type="button" className={`icon-btn remove ${btnClass("remove")}`} onClick={onRemove} disabled={isBusy && loadingAction !== "remove"}>
                            {confirmAction === "remove" ? "Confirm?" : "\u{1F5D1} Remove"}
                        </button>
                    </div>
                </section>
            )}

            {/* Tab: Feed */}
            {activeTab === 2 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#128218;</span>
                        <h2>Feed Browser</h2>
                    </div>
                    <div className="form-group" style={{ marginBottom: "1rem" }}>
                        <label htmlFor="feedId">Post ID</label>
                        <input id="feedId" name="id" value={form.id} onChange={setField} />
                        <span className="helper">Enter a post ID to fetch its details</span>
                    </div>
                    <div className="query-row">
                        <button type="button" className={`btn-ghost ${btnClass("get")}`} onClick={onGet} disabled={isBusy}>Get Post</button>
                        <button type="button" className={`btn-ghost ${btnClass("list")}`} onClick={onList} disabled={isBusy}>List Posts</button>
                        <button type="button" className={`btn-ghost ${btnClass("count")}`} onClick={onCount} disabled={isBusy}>Get Count</button>
                    </div>
                </section>
            )}

            {/* Post Details (Output) */}
            <section className={`output-panel ${status}`}>
                <h2>&#128196; Post Details</h2>
                {outputIsEmpty ? (
                    <div className="empty-state">Connect your wallet and perform an action to see results here.</div>
                ) : (
                    <pre id="output">{output}</pre>
                )}
            </section>
        </main>
    );
}
