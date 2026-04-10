import React, { useState, useRef } from "react";
import { checkConnection, listResource, borrowResource, returnResource, rateTransaction, getResource, listResources, getAvailableCount } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

export default function App() {
    const [form, setForm] = useState({
        id: "res1",
        owner: "",
        name: "Power Drill",
        description: "Cordless power drill, good condition",
        category: "tools",
        dailyRate: "50000000",
        depositRequired: "200000000",
        borrower: "",
        startDate: String(nowTs()),
        endDate: String(nowTs() + 86400 * 3),
        conditionNotes: "Returned in good condition",
        rating: "5",
    });
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [walletState, setWalletState] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [availableCount, setAvailableCount] = useState("-");
    const [activeTab, setActiveTab] = useState("list");
    const confirmTimers = useRef({});
    const [confirmingBtn, setConfirmingBtn] = useState(null);

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

    const onConnect = () => runAction("connect", async () => {
        const user = await checkConnection();
        if (user) {
            setWalletState(user.publicKey);
            setForm((prev) => ({
                ...prev,
                owner: user.publicKey,
                borrower: prev.borrower || user.publicKey,
            }));
            return `Connected: ${user.publicKey}`;
        }
        setWalletState(null);
        return "Wallet: not connected";
    });

    const onListResource = () => runAction("listResource", async () =>
        listResource({
            id: form.id.trim(),
            owner: form.owner.trim(),
            name: form.name.trim(),
            description: form.description.trim(),
            category: form.category.trim(),
            dailyRate: form.dailyRate.trim(),
            depositRequired: form.depositRequired.trim(),
        })
    );

    const onBorrow = () => runAction("borrow", async () =>
        borrowResource({
            id: form.id.trim(),
            borrower: form.borrower.trim(),
            startDate: form.startDate.trim(),
            endDate: form.endDate.trim(),
        })
    );

    const onReturn = () => runAction("return", async () =>
        returnResource({
            id: form.id.trim(),
            borrower: form.borrower.trim(),
            conditionNotes: form.conditionNotes.trim(),
        })
    );

    const handleDestructive = (btnKey, action) => {
        if (confirmingBtn === btnKey) {
            clearTimeout(confirmTimers.current[btnKey]);
            setConfirmingBtn(null);
            action();
        } else {
            setConfirmingBtn(btnKey);
            confirmTimers.current[btnKey] = setTimeout(() => setConfirmingBtn(null), 3000);
        }
    };

    const onRate = () => runAction("rate", async () =>
        rateTransaction({
            id: form.id.trim(),
            rater: form.borrower.trim() || form.owner.trim(),
            rating: form.rating.trim(),
        })
    );

    const onGetResource = () => runAction("getResource", async () => getResource(form.id.trim()));

    const onListResources = () => runAction("listResources", async () => listResources());

    const onGetAvailable = () => runAction("getAvailable", async () => {
        const value = await getAvailableCount();
        setAvailableCount(String(value));
        return { available: value };
    });

    const ratingNum = Math.min(5, Math.max(0, parseInt(form.rating, 10) || 0));

    const truncAddr = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
    const tabs = [
        { key: "list", label: "List Resource" },
        { key: "borrow", label: "Borrow/Return" },
        { key: "rate", label: "Rate & Query" },
    ];

    return (
        <main className="app">
            {/* Wallet Status Bar */}
            <div className="wallet-status-bar">
                <div className="wallet-status-left">
                    <span className={`wallet-dot ${walletState ? "connected" : ""}`} />
                    <span className="wallet-addr">
                        {walletState ? truncAddr(walletState) : "Not connected"}
                    </span>
                </div>
                <button
                    type="button"
                    id="connectWallet"
                    onClick={onConnect}
                    disabled={isBusy}
                    className={loadingAction === "connect" ? "btn-loading" : ""}
                >
                    {walletState ? "Reconnect" : "Connect Freighter"}
                </button>
            </div>

            {/* Hero */}
            <section className="hero">
                <div className="hero-icon">&#129309;</div>
                <p className="kicker">Stellar Soroban Project 25</p>
                <h1>Resource Sharing Platform</h1>
                <p className="subtitle">
                    List resources for lending, borrow and return items, and rate transactions on the Stellar network.
                </p>
                <span className="avail-badge">Available: {availableCount}</span>
            </section>

            {/* Tab Navigation */}
            <div className="tab-bar">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        className={`tab-btn ${activeTab === t.key ? "active" : ""}`}
                        onClick={() => setActiveTab(t.key)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab: List a Resource */}
            {activeTab === "list" && (
                <section className="card">
                    <h2>List a Resource</h2>
                    <div className="form-grid">
                        <div className="field">
                            <label htmlFor="id">Resource ID</label>
                            <input id="id" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Unique resource identifier</span>
                        </div>
                        <div className="field">
                            <label htmlFor="owner">Owner Address</label>
                            <input id="owner" name="owner" value={form.owner} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key starting with G</span>
                        </div>
                        <div className="field">
                            <label htmlFor="name">Resource Name</label>
                            <input id="name" name="name" value={form.name} onChange={setField} />
                        </div>
                        <div className="field">
                            <label htmlFor="category">Category</label>
                            <input id="category" name="category" value={form.category} onChange={setField} placeholder="tools/electronics/books" />
                        </div>
                        <div className="field full">
                            <label htmlFor="description">Description</label>
                            <input id="description" name="description" value={form.description} onChange={setField} />
                        </div>
                        <div className="field">
                            <label htmlFor="dailyRate">Daily Rate (stroops)</label>
                            <input id="dailyRate" name="dailyRate" value={form.dailyRate} onChange={setField} type="number" />
                            <span className="helper">1 XLM = 10,000,000 stroops</span>
                        </div>
                        <div className="field">
                            <label htmlFor="depositRequired">Deposit Required (stroops)</label>
                            <input id="depositRequired" name="depositRequired" value={form.depositRequired} onChange={setField} type="number" />
                            <span className="helper">1 XLM = 10,000,000 stroops</span>
                        </div>
                    </div>
                    <div className="btn-group">
                        <button
                            type="button"
                            className={`btn-primary ${loadingAction === "listResource" ? "btn-loading" : ""}`}
                            onClick={onListResource}
                            disabled={isBusy}
                        >
                            List Resource
                        </button>
                    </div>
                </section>
            )}

            {/* Tab: Borrow & Return */}
            {activeTab === "borrow" && (
                <div className="borrow-return">
                    <section className="card">
                        <h2>Borrow</h2>
                        <div className="field">
                            <label htmlFor="borrower">Borrower Address</label>
                            <input id="borrower" name="borrower" value={form.borrower} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key starting with G</span>
                        </div>
                        <div className="field">
                            <label htmlFor="startDate">Start Date (u64)</label>
                            <input id="startDate" name="startDate" value={form.startDate} onChange={setField} type="number" />
                            <span className="helper">Unix timestamp in seconds</span>
                        </div>
                        <div className="field">
                            <label htmlFor="endDate">End Date (u64)</label>
                            <input id="endDate" name="endDate" value={form.endDate} onChange={setField} type="number" />
                            <span className="helper">Unix timestamp in seconds</span>
                        </div>
                        <div className="btn-group">
                            <button
                                type="button"
                                className={`btn-primary ${loadingAction === "borrow" ? "btn-loading" : ""}`}
                                onClick={onBorrow}
                                disabled={isBusy}
                            >
                                Borrow
                            </button>
                        </div>
                    </section>

                    <section className="card">
                        <h2>Return</h2>
                        <div className="field">
                            <label htmlFor="conditionNotes">Condition Notes</label>
                            <input id="conditionNotes" name="conditionNotes" value={form.conditionNotes} onChange={setField} />
                        </div>
                        <div className="btn-group">
                            <button
                                type="button"
                                className={`btn-secondary ${loadingAction === "return" ? "btn-loading" : ""}`}
                                onClick={onReturn}
                                disabled={isBusy}
                            >
                                Return Item
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {/* Tab: Rate & Query */}
            {activeTab === "rate" && (
                <>
                    <section className="card">
                        <h2>Rate Experience</h2>
                        <div className="form-grid">
                            <div className="field">
                                <label htmlFor="rating">Rating (1-5)</label>
                                <input id="rating" name="rating" value={form.rating} onChange={setField} type="number" />
                                <div className="rating-display">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <span key={n} className={`star ${n <= ratingNum ? "filled" : ""}`}>
                                            &#9733;
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="btn-group">
                            <button
                                type="button"
                                className={`btn-secondary ${loadingAction === "rate" ? "btn-loading" : ""}`}
                                onClick={onRate}
                                disabled={isBusy}
                            >
                                Submit Rating
                            </button>
                        </div>
                    </section>

                    <section className="card">
                        <h2>Resource Catalog</h2>
                        <div className="query-strip">
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "getResource" ? "btn-loading" : ""}`}
                                onClick={onGetResource}
                                disabled={isBusy}
                            >
                                Get Resource
                            </button>
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "listResources" ? "btn-loading" : ""}`}
                                onClick={onListResources}
                                disabled={isBusy}
                            >
                                List Resources
                            </button>
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "getAvailable" ? "btn-loading" : ""}`}
                                onClick={onGetAvailable}
                                disabled={isBusy}
                            >
                                Available Count
                            </button>
                        </div>
                    </section>
                </>
            )}

            {/* Output */}
            <section className="card catalog-output">
                <h2>Catalog Details</h2>
                <pre id="output" className={`status-${status}`}>
                    {output || "List, borrow, or query resources to see results here."}
                </pre>
            </section>
        </main>
    );
}
