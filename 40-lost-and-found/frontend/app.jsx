import React, { useRef, useState } from "react";
import { checkConnection, reportItem, claimItem, markResolved, getItem, listItems, getOpenCount } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const truncateAddress = (value) => {
    if (!value || value.length < 12) return value;
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

export default function App() {
    const [form, setForm] = useState({
        id: "item1",
        reporter: "",
        claimant: "",
        name: "Blue Backpack",
        description: "Found near the library help desk.",
        category: "bags",
        reportedAt: String(nowTs()),
    });
    const [output, setOutput] = useState("Ready to log lost-and-found items.");
    const [status, setStatus] = useState("idle");
    const [walletKey, setWalletKey] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState("");
    const [activeTab, setActiveTab] = useState("report");
    const [openCount, setOpenCount] = useState("-");
    const [confirmResolve, setConfirmResolve] = useState(false);
    const resolveTimer = useRef(null);

    const setField = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const runAction = async (actionName, action) => {
        setIsBusy(true);
        setLoadingAction(actionName);
        try {
            const result = await action();
            setOutput(toOutput(result ?? "No data found"));
            setStatus("success");
        } catch (error) {
            setOutput(error?.message || String(error));
            setStatus("error");
        } finally {
            setIsBusy(false);
            setLoadingAction("");
        }
    };

    const onConnect = () => runAction("connect", async () => {
        const user = await checkConnection();
        if (!user) {
            setWalletKey("");
            return "Wallet: not connected";
        }

        setWalletKey(user.publicKey);
        setForm((prev) => ({
            ...prev,
            reporter: prev.reporter || user.publicKey,
            claimant: prev.claimant || user.publicKey,
        }));
        return `Wallet: ${user.publicKey}`;
    });

    const onReportItem = () => runAction("report", () => reportItem({
        id: form.id.trim(),
        reporter: form.reporter.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        reportedAt: form.reportedAt.trim(),
    }));

    const onClaimItem = () => runAction("claim", () => claimItem(form.id.trim(), form.claimant.trim()));

    const onResolveItem = () => {
        if (confirmResolve) {
            clearTimeout(resolveTimer.current);
            setConfirmResolve(false);
            runAction("resolve", () => markResolved(form.id.trim(), form.reporter.trim()));
            return;
        }

        setConfirmResolve(true);
        resolveTimer.current = setTimeout(() => setConfirmResolve(false), 3000);
    };

    const onGetItem = () => runAction("get", () => getItem(form.id.trim()));
    const onListItems = () => runAction("list", () => listItems());
    const onGetCount = () => runAction("count", async () => {
        const value = await getOpenCount();
        setOpenCount(String(value));
        return { openItems: value };
    });

    const btnClass = (actionName, extra = "") => [extra, loadingAction === actionName ? "btn-loading" : ""].filter(Boolean).join(" ");
    const outputClass = status === "success" ? "output-success" : status === "error" ? "output-error" : "output-idle";
    const tabs = [
        { key: "report", label: "Report" },
        { key: "claim", label: "Claim" },
        { key: "lookup", label: "Lookup" },
    ];

    return (
        <main className="app">
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 43</p>
                <h1>Lost and Found</h1>
                <p className="subtitle">Report items, record claims, and close out resolutions with a simple Stellar workflow.</p>
                <div className="hero-stats">
                    <span className="stat-chip">Open Items: {openCount}</span>
                    <span className="stat-chip">Category: {form.category || "-"}</span>
                </div>
            </section>

            <div className="wallet-bar">
                <div className="wallet-info">
                    <span className={`wallet-dot ${walletKey ? "connected" : ""}`}></span>
                    <span>{walletKey ? truncateAddress(walletKey) : "Not connected"}</span>
                </div>
                <button type="button" className={btnClass("connect", "btn-secondary")} onClick={onConnect} disabled={isBusy}>
                    {walletKey ? "Reconnect" : "Connect Freighter"}
                </button>
            </div>

            <div className="tab-bar">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === "report" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Report Item</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="id">Item ID</label>
                                <input id="id" name="id" value={form.id} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="reporter">Reporter Address</label>
                                <input id="reporter" name="reporter" value={form.reporter} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field">
                                <label htmlFor="name">Item Name</label>
                                <input id="name" name="name" value={form.name} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="category">Category</label>
                                <input id="category" name="category" value={form.category} onChange={setField} />
                            </div>
                            <div className="field full">
                                <label htmlFor="description">Description</label>
                                <textarea id="description" name="description" rows="3" value={form.description} onChange={setField} />
                            </div>
                            <div className="field full">
                                <label htmlFor="reportedAt">Reported At (u64)</label>
                                <input id="reportedAt" name="reportedAt" value={form.reportedAt} onChange={setField} type="number" />
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("report", "btn-primary")} onClick={onReportItem} disabled={isBusy}>
                                Report Item
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === "claim" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Claim Workflow</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="claimant">Claimant Address</label>
                                <input id="claimant" name="claimant" value={form.claimant} onChange={setField} placeholder="G..." />
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("claim", "btn-primary")} onClick={onClaimItem} disabled={isBusy}>
                                Claim Item
                            </button>
                            <button type="button" className={btnClass("resolve", "btn-warning")} onClick={onResolveItem} disabled={isBusy}>
                                {confirmResolve ? "Confirm Resolve?" : "Mark Resolved"}
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === "lookup" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Lookup</h2>
                    </div>
                    <div className="card-body">
                        <div className="actions">
                            <button type="button" className={btnClass("get", "btn-ghost")} onClick={onGetItem} disabled={isBusy}>
                                Get Item
                            </button>
                            <button type="button" className={btnClass("list", "btn-ghost")} onClick={onListItems} disabled={isBusy}>
                                List Items
                            </button>
                            <button type="button" className={btnClass("count", "btn-ghost")} onClick={onGetCount} disabled={isBusy}>
                                Get Open Count
                            </button>
                        </div>
                    </div>
                </section>
            )}

            <section className="card">
                <div className="card-header">
                    <h2>Contract Output</h2>
                </div>
                <div className="card-body">
                    <pre className={`output-box ${outputClass}`}>{output}</pre>
                </div>
            </section>
        </main>
    );
}
