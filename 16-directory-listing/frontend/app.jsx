import React, { useState, useRef, useEffect } from "react";
import { checkConnection, createListing, updateListing, verifyListing, deactivateListing, rateListing, getListing, listAll } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const initialForm = () => ({
    id: "biz1",
    owner: "",
    name: "Stellar Coffee Shop",
    category: "food",
    description: "Best coffee in town",
    contact: "hello@stellarcoffee.io",
    website: "https://stellarcoffee.io",
    location: "123 Main St, Blockchain City",
    verifier: "",
    rater: "",
    rating: "5",
});

const TABS = ["Create Listing", "Manage", "Browse"];

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
                owner: prev.owner || user.publicKey,
                verifier: prev.verifier || user.publicKey,
                rater: prev.rater || user.publicKey,
            }));
        }
        const next = user ? `Wallet: ${user.publicKey}` : "Wallet: not connected";
        setWalletState(next);
        return next;
    }));

    const onCreate = withLoading("create", () => runAction(async () => createListing({
        id: form.id.trim(),
        owner: form.owner.trim(),
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        contact: form.contact.trim(),
        website: form.website.trim(),
        location: form.location.trim(),
    })));

    const onUpdate = withLoading("update", () => runAction(async () => updateListing({
        id: form.id.trim(),
        owner: form.owner.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        contact: form.contact.trim(),
        website: form.website.trim(),
    })));

    const onVerify = withLoading("verify", () => runAction(async () => verifyListing({
        id: form.id.trim(),
        verifier: form.verifier.trim() || form.owner.trim(),
    })));

    const onDeactivate = handleDestructive("deactivate", withLoading("deactivate", () => runAction(async () => deactivateListing({
        id: form.id.trim(),
        owner: form.owner.trim(),
    }))));

    const onRate = withLoading("rate", () => runAction(async () => rateListing({
        id: form.id.trim(),
        rater: form.rater.trim() || form.owner.trim(),
        rating: form.rating.trim(),
    })));

    const onGet = withLoading("get", () => runAction(async () => getListing(form.id.trim())));

    const onList = withLoading("list", () => runAction(async () => listAll()));

    const ratingNum = parseInt(form.rating, 10) || 0;
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
                <p className="kicker">Stellar Soroban Project 16</p>
                <div className="hero-icon">&#128214;</div>
                <h1>Business Directory</h1>
                <p className="subtitle">
                    Create, verify, rate, and manage business listings on the Stellar blockchain.
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

            {/* Tab: Create Listing */}
            {activeTab === 0 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#128203;</span>
                        <h2>Create Listing</h2>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="listingId">Listing ID</label>
                            <input id="listingId" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Unique identifier for this business listing</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="owner">Owner Address</label>
                            <input id="owner" name="owner" value={form.owner} onChange={setField} placeholder="G..." />
                            <span className="helper">Auto-filled on wallet connect</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="name">Business Name</label>
                            <input id="name" name="name" value={form.name} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="category">Category</label>
                            <input id="category" name="category" value={form.category} onChange={setField} placeholder="food, retail, tech..." />
                            <span className="helper">E.g. food, retail, tech, health</span>
                        </div>
                        <div className="form-group full">
                            <label htmlFor="description">Description</label>
                            <textarea id="description" name="description" rows="3" value={form.description} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="contact">Contact</label>
                            <input id="contact" name="contact" value={form.contact} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="website">Website</label>
                            <input id="website" name="website" value={form.website} onChange={setField} />
                        </div>
                        <div className="form-group full">
                            <label htmlFor="location">Location</label>
                            <input id="location" name="location" value={form.location} onChange={setField} />
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className={btnClass("create")} onClick={onCreate} disabled={isBusy}>Create Listing</button>
                        <button type="button" className={`btn-secondary ${btnClass("update")}`} onClick={onUpdate} disabled={isBusy}>Update Listing</button>
                    </div>
                </section>
            )}

            {/* Tab: Manage */}
            {activeTab === 1 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#9874;</span>
                        <h2>Manage Listing</h2>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="verifier">Verifier Address</label>
                            <input id="verifier" name="verifier" value={form.verifier} onChange={setField} placeholder="G..." />
                            <span className="helper">Address of the account verifying this listing</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="rater">Rater Address</label>
                            <input id="rater" name="rater" value={form.rater} onChange={setField} placeholder="G..." />
                            <span className="helper">Defaults to owner if left empty</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="rating">Rating (1-5)</label>
                            <input id="rating" name="rating" value={form.rating} onChange={setField} type="number" min="1" max="5" />
                            <div className="star-row">
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <span key={s} className={`star ${s <= ratingNum ? "filled" : ""}`}
                                        onClick={() => setForm((prev) => ({ ...prev, rating: String(s) }))}>
                                        &#9733;
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className={btnClass("verify")} onClick={onVerify} disabled={isBusy}>Verify Listing</button>
                        <button type="button" className={btnClass("rate")} onClick={onRate} disabled={isBusy}>Rate Listing</button>
                        <button type="button" className={`btn-danger ${btnClass("deactivate")}`} onClick={onDeactivate} disabled={isBusy && loadingAction !== "deactivate"}>
                            {confirmAction === "deactivate" ? "Confirm?" : "Deactivate"}
                        </button>
                    </div>
                </section>
            )}

            {/* Tab: Browse */}
            {activeTab === 2 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#128269;</span>
                        <h2>Directory Search</h2>
                    </div>
                    <div className="form-group" style={{ marginBottom: "1rem" }}>
                        <label htmlFor="searchId">Listing ID</label>
                        <input id="searchId" name="id" value={form.id} onChange={setField} />
                        <span className="helper">Enter a listing ID to fetch its details</span>
                    </div>
                    <div className="query-row">
                        <button type="button" className={`btn-ghost ${btnClass("get")}`} onClick={onGet} disabled={isBusy}>Get Listing</button>
                        <button type="button" className={`btn-ghost ${btnClass("list")}`} onClick={onList} disabled={isBusy}>List All</button>
                    </div>
                </section>
            )}

            {/* Output Panel */}
            <section className={`output-panel ${status}`}>
                <h2>&#128196; Listing Details</h2>
                {outputIsEmpty ? (
                    <div className="empty-state">Connect your wallet and perform an action to see results here.</div>
                ) : (
                    <pre id="output">{output}</pre>
                )}
            </section>
        </main>
    );
}
