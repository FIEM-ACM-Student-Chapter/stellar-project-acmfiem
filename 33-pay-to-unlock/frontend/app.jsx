import React, { useState, useRef, useEffect } from "react";
import { checkConnection, createContent, purchaseContent, hasAccess, updatePrice, withdrawEarnings, getContent, listContent, getContentCount } from "../lib.js/stellar.js";

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
        id: "content1",
        creator: "",
        title: "Advanced Soroban Patterns",
        preview: "Learn advanced smart contract patterns...",
        contentHash: "QmExampleHash123",
        price: "1000",
        buyer: "",
        paymentAmount: "1000",
        newPrice: "1500",
        user: "",
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
                creator: prev.creator || user.publicKey,
                buyer: prev.buyer || user.publicKey,
                user: prev.user || user.publicKey,
            }));
        }
        return nextWalletState;
    });

    const onCreateContent = () => runAction("createContent", async () => createContent({
        id: form.id.trim(),
        creator: form.creator.trim(),
        title: form.title.trim(),
        preview: form.preview.trim(),
        contentHash: form.contentHash.trim(),
        price: form.price.trim(),
    }));

    const onPurchase = () => runAction("purchase", async () => purchaseContent({
        contentId: form.id.trim(),
        buyer: form.buyer.trim(),
        paymentAmount: form.paymentAmount.trim(),
    }));

    const onHasAccess = () => runAction("hasAccess", async () => {
        const value = await hasAccess(form.id.trim(), form.user.trim() || form.buyer.trim());
        return { hasAccess: value };
    });

    const onUpdatePrice = () => runAction("updatePrice", async () => updatePrice({
        id: form.id.trim(),
        creator: form.creator.trim(),
        newPrice: form.newPrice.trim(),
    }));

    const onWithdraw = () => runAction("withdraw", async () => withdrawEarnings({
        id: form.id.trim(),
        creator: form.creator.trim(),
    }));

    const onGetContent = () => runAction("getContent", async () => getContent(form.id.trim()));

    const onList = () => runAction("list", async () => listContent());

    const onCount = () => runAction("count", async () => {
        const value = await getContentCount();
        setCountValue(String(value));
        return { count: value };
    });

    const tabs = ["Create Content", "Purchase", "Creator Dashboard"];

    return (
        <main className="app">
            {/* ---- Wallet Status Bar ---- */}
            <div className="wallet-status-bar">
                <span className={`wallet-dot ${connectedAddress ? "connected" : ""}`} />
                <span className="wallet-status-text">
                    {connectedAddress ? truncateAddress(connectedAddress) : "Not connected"}
                </span>
            </div>

            {/* ---- Hero ---- */}
            <section className="hero">
                <div className="hero-icon">&#128274;</div>
                <h1>Premium Vault</h1>
                <p className="subtitle">Publish, monetize, and unlock exclusive content on the Stellar network.</p>

                <div className="wallet-bar">
                    <button type="button" id="connectWallet" onClick={onConnect} className={loadingAction === "connect" ? "btn-loading" : ""} disabled={isBusy}>
                        Connect Freighter
                    </button>
                    <span className="wallet-text" id="walletState">{walletState}</span>
                </div>

                <p className="content-count">
                    Published content: <span>{countValue}</span>
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

            {/* ---- Tab 0: Create Premium Content ---- */}
            {activeTab === 0 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#128142;</span>
                        <h2>Create Premium Content</h2>
                    </div>
                    <div className="card-body">
                        <div className="form-grid">
                            <div className="field">
                                <label htmlFor="id">Content ID (Symbol)</label>
                                <input id="id" name="id" value={form.id} onChange={setField} />
                                <span className="field-helper">Unique identifier for your content</span>
                            </div>
                            <div className="field">
                                <label htmlFor="creator">Creator Address</label>
                                <input id="creator" name="creator" value={form.creator} onChange={setField} placeholder="G..." />
                                <span className="field-helper">Auto-filled on wallet connect</span>
                            </div>
                            <div className="field full-width">
                                <label htmlFor="title">Title</label>
                                <input id="title" name="title" value={form.title} onChange={setField} />
                            </div>
                            <div className="field full-width">
                                <label htmlFor="preview">Preview Text</label>
                                <textarea id="preview" name="preview" rows="2" value={form.preview} onChange={setField} />
                                <span className="field-helper">Visible to all users before purchase</span>
                            </div>
                            <div className="field">
                                <label htmlFor="contentHash">Content Hash</label>
                                <input id="contentHash" name="contentHash" value={form.contentHash} onChange={setField} />
                                <span className="field-helper">IPFS or other storage hash</span>
                            </div>
                            <div className="field">
                                <label htmlFor="price">Price (i128)</label>
                                <input id="price" name="price" value={form.price} onChange={setField} type="number" />
                                {form.price && (
                                    <div className="price-display">
                                        <span className="price-currency">XLM</span>
                                        <span className="price-amount">{form.price}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="actions">
                            <button type="button" className={`btn ${loadingAction === "createContent" ? "btn-loading" : ""}`} onClick={onCreateContent} disabled={isBusy}>Publish Content</button>
                        </div>
                    </div>
                </section>
            )}

            {/* ---- Tab 1: Purchase & Access ---- */}
            {activeTab === 1 && (
                <section className="card premium-card">
                    <div className="card-header">
                        <span className="card-icon">&#128275;</span>
                        <h2>Purchase &amp; Access</h2>
                    </div>
                    <div className="card-body">
                        <div className="form-grid">
                            <div className="field">
                                <label htmlFor="buyer">Buyer Address</label>
                                <input id="buyer" name="buyer" value={form.buyer} onChange={setField} placeholder="G..." />
                                <span className="field-helper">Your Stellar address (auto-filled)</span>
                            </div>
                            <div className="field">
                                <label htmlFor="paymentAmount">Payment Amount (i128)</label>
                                <input id="paymentAmount" name="paymentAmount" value={form.paymentAmount} onChange={setField} type="number" />
                                <span className="field-helper">Must match or exceed content price</span>
                            </div>
                            <div className="field full-width">
                                <label htmlFor="user">Check Access For (optional)</label>
                                <input id="user" name="user" value={form.user} onChange={setField} placeholder="G..." />
                            </div>
                        </div>

                        <div className="actions">
                            <button type="button" className={`btn btn-gold ${loadingAction === "purchase" ? "btn-loading" : ""}`} onClick={onPurchase} disabled={isBusy}>&#128274; Purchase</button>
                            <button type="button" className={`btn btn-outline ${loadingAction === "hasAccess" ? "btn-loading" : ""}`} onClick={onHasAccess} disabled={isBusy}>&#128275; Check Access</button>
                        </div>
                    </div>
                </section>
            )}

            {/* ---- Tab 2: Creator Dashboard ---- */}
            {activeTab === 2 && (
                <>
                    <section className="card">
                        <div className="card-header">
                            <span className="card-icon">&#128200;</span>
                            <h2>Creator Dashboard</h2>
                        </div>
                        <div className="card-body">
                            <div className="form-grid">
                                <div className="field">
                                    <label htmlFor="newPrice">New Price (i128)</label>
                                    <input id="newPrice" name="newPrice" value={form.newPrice} onChange={setField} type="number" />
                                    <span className="field-helper">Update the price for your content</span>
                                </div>
                            </div>

                            <div className="actions">
                                <button type="button" className={`btn btn-outline ${loadingAction === "updatePrice" ? "btn-loading" : ""}`} onClick={onUpdatePrice} disabled={isBusy}>Update Price</button>
                                <button type="button" className={`btn btn-gold ${loadingAction === "withdraw" ? "btn-loading" : ""}`} onClick={onWithdraw} disabled={isBusy}>Withdraw Earnings</button>
                            </div>
                        </div>
                    </section>

                    <section className="card">
                        <div className="card-header">
                            <span className="card-icon">&#128218;</span>
                            <h2>Content Registry</h2>
                        </div>
                        <div className="card-body">
                            <div className="actions">
                                <button type="button" className={`btn btn-ghost ${loadingAction === "getContent" ? "btn-loading" : ""}`} onClick={onGetContent} disabled={isBusy}>Get Content</button>
                                <button type="button" className={`btn btn-ghost ${loadingAction === "list" ? "btn-loading" : ""}`} onClick={onList} disabled={isBusy}>List Content</button>
                                <button type="button" className={`btn btn-ghost ${loadingAction === "count" ? "btn-loading" : ""}`} onClick={onCount} disabled={isBusy}>Get Count</button>
                            </div>
                        </div>
                    </section>
                </>
            )}

            {/* ---- Output ---- */}
            <section className="card output-card">
                <div className="card-header">
                    <span className="card-icon">&#128196;</span>
                    <h2>Result</h2>
                </div>
                <div className="card-body">
                    <pre id="output" className={`output-pre status-${status}`}>
                        {output || "Connect your wallet to publish or purchase premium content. Results will appear here."}
                    </pre>
                </div>
            </section>
        </main>
    );
}
