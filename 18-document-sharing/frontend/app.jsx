import React, { useState, useRef, useEffect } from "react";
import { checkConnection, uploadDoc, shareDoc, revokeAccess, updateDoc, getDoc, listDocs, getDocCount } from "../lib.js/stellar.js";

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const initialForm = () => ({
    id: "doc1",
    owner: "",
    title: "Project Whitepaper",
    docHash: "QmXoYpBf7c5e4a1d2b3...",
    docType: "pdf",
    fileSize: "2048",
    sharedWith: "",
    revokedFrom: "",
    newHash: "",
    newSize: "",
});

const FILE_TYPE_ICONS = {
    pdf: "\u{1F4D5}",
    doc: "\u{1F4C4}",
    img: "\u{1F5BC}",
};

const TABS = ["Upload", "Sharing", "Browse"];

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
                owner: prev.owner || user.publicKey,
            }));
        }
        const next = user ? `Wallet: ${user.publicKey}` : "Wallet: not connected";
        setWalletState(next);
        return next;
    }));

    const onUpload = withLoading("upload", () => runAction(async () => uploadDoc({
        id: form.id.trim(),
        owner: form.owner.trim(),
        title: form.title.trim(),
        docHash: form.docHash.trim(),
        docType: form.docType.trim(),
        fileSize: form.fileSize.trim(),
    })));

    const onShare = withLoading("share", () => runAction(async () => shareDoc({
        id: form.id.trim(),
        owner: form.owner.trim(),
        sharedWith: form.sharedWith.trim(),
    })));

    const onRevoke = handleDestructive("revoke", withLoading("revoke", () => runAction(async () => revokeAccess({
        id: form.id.trim(),
        owner: form.owner.trim(),
        revokedFrom: form.revokedFrom.trim(),
    }))));

    const onUpdate = withLoading("update", () => runAction(async () => updateDoc({
        id: form.id.trim(),
        owner: form.owner.trim(),
        newHash: form.newHash.trim(),
        newSize: form.newSize.trim(),
    })));

    const onGet = withLoading("get", () => runAction(async () => getDoc(form.id.trim())));

    const onList = withLoading("listDocs", () => runAction(async () => listDocs()));

    const onCount = withLoading("count", () => runAction(async () => {
        const value = await getDocCount();
        setCountValue(String(value));
        return { count: value };
    }));

    const docTypeKey = form.docType.trim().toLowerCase();
    const badgeClass = ["pdf", "doc", "img"].includes(docTypeKey) ? docTypeKey : "default";
    const fileIcon = FILE_TYPE_ICONS[docTypeKey] || "\u{1F4CE}";

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
                <span className="doc-count">Documents: {countValue}</span>
                <button type="button" className={btnClass("connect")} onClick={onConnect} disabled={isBusy}>
                    {isConnected ? "Reconnect" : "Connect Freighter"}
                </button>
            </div>

            {/* Hero */}
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 18</p>
                <div className="hero-icon">&#128193;</div>
                <h1>Document Sharing</h1>
                <p className="subtitle">
                    Upload, share, version, and manage document metadata on the Stellar blockchain.
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

            {/* Tab: Upload */}
            {activeTab === 0 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#128228;</span>
                        <h2>Upload Document</h2>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="docId">Document ID</label>
                            <input id="docId" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Unique identifier for this document</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="owner">Owner Address</label>
                            <input id="owner" name="owner" value={form.owner} onChange={setField} placeholder="G..." />
                            <span className="helper">Auto-filled on wallet connect</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="title">Document Title</label>
                            <input id="title" name="title" value={form.title} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="docType">
                                Document Type{" "}
                                <span className={`file-type-badge ${badgeClass}`}>
                                    {fileIcon} {form.docType || "---"}
                                </span>
                            </label>
                            <input id="docType" name="docType" value={form.docType} onChange={setField} placeholder="pdf, doc, img..." />
                            <span className="helper">Supported: pdf, doc, img</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="docHash">Document Hash</label>
                            <input id="docHash" name="docHash" value={form.docHash} onChange={setField} placeholder="IPFS or content hash" />
                            <span className="helper">IPFS CID or content hash for verification</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="fileSize">File Size (bytes)</label>
                            <input id="fileSize" name="fileSize" value={form.fileSize} onChange={setField} type="number" />
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className={btnClass("upload")} onClick={onUpload} disabled={isBusy}>Upload Document</button>
                        <button type="button" className={`btn-secondary ${btnClass("update")}`} onClick={onUpdate} disabled={isBusy}>Update Version</button>
                    </div>
                </section>
            )}

            {/* Tab: Sharing */}
            {activeTab === 1 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#128101;</span>
                        <h2>Sharing Controls</h2>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="shareDocId">Document ID</label>
                            <input id="shareDocId" name="id" value={form.id} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="sharedWith">Share With Address</label>
                            <input id="sharedWith" name="sharedWith" value={form.sharedWith} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar address to grant read access</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="revokedFrom">Revoke From Address</label>
                            <input id="revokedFrom" name="revokedFrom" value={form.revokedFrom} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar address to remove access from</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="newHash">New Hash (for update)</label>
                            <input id="newHash" name="newHash" value={form.newHash} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="newSize">New Size (for update)</label>
                            <input id="newSize" name="newSize" value={form.newSize} onChange={setField} type="number" />
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className={`btn-share ${btnClass("share")}`} onClick={onShare} disabled={isBusy}>Share Document</button>
                        <button type="button" className={`btn-revoke ${btnClass("revoke")}`} onClick={onRevoke} disabled={isBusy && loadingAction !== "revoke"}>
                            {confirmAction === "revoke" ? "Confirm?" : "Revoke Access"}
                        </button>
                    </div>
                </section>
            )}

            {/* Tab: Browse */}
            {activeTab === 2 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#128269;</span>
                        <h2>Document Browser</h2>
                    </div>
                    <div className="form-group" style={{ marginBottom: "1rem" }}>
                        <label htmlFor="browseId">Document ID</label>
                        <input id="browseId" name="id" value={form.id} onChange={setField} />
                        <span className="helper">Enter a document ID to fetch its details</span>
                    </div>
                    <div className="query-row">
                        <button type="button" className={`btn-ghost ${btnClass("get")}`} onClick={onGet} disabled={isBusy}>Get Document</button>
                        <button type="button" className={`btn-ghost ${btnClass("listDocs")}`} onClick={onList} disabled={isBusy}>List Documents</button>
                        <button type="button" className={`btn-ghost ${btnClass("count")}`} onClick={onCount} disabled={isBusy}>Get Count</button>
                    </div>
                </section>
            )}

            {/* File Details (Output) */}
            <section className={`output-panel ${status}`}>
                <h2>&#128196; File Details</h2>
                {outputIsEmpty ? (
                    <div className="empty-state">Connect your wallet and perform an action to see results here.</div>
                ) : (
                    <pre id="output">{output}</pre>
                )}
            </section>
        </main>
    );
}
