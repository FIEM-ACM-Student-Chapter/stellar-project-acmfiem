import React, { useState, useRef, useEffect } from "react";
import { checkConnection, createAd, approveAd, recordView, pauseAd, resumeAd, getAd, listAds, getAdCount } from "../lib.js/stellar.js";

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

export default function App() {
    const [form, setForm] = useState({
        id: "ad1",
        advertiser: "",
        publisher: "",
        viewer: "",
        title: "Summer Sale Campaign",
        content: "Get 50% off all items this summer!",
        targetAudience: "general",
        budget: "10000",
        costPerView: "10",
    });
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [walletState, setWalletState] = useState("Wallet: not connected");
    const [walletConnected, setWalletConnected] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [adCount, setAdCount] = useState("-");
    const [activeTab, setActiveTab] = useState(0);
    const [confirmPause, setConfirmPause] = useState(false);
    const pauseTimer = useRef(null);

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
            const addr = user.publicKey;
            setWalletState(addr);
            setWalletConnected(true);
            setForm((prev) => ({
                ...prev,
                advertiser: prev.advertiser || addr,
                publisher: prev.publisher || addr,
                viewer: prev.viewer || addr,
            }));
            return `Wallet: ${addr}`;
        }
        setWalletState("Wallet: not connected");
        setWalletConnected(false);
        return "Wallet: not connected";
    });

    const onCreateAd = () => runAction("createAd", () => createAd({
        id: form.id.trim(),
        advertiser: form.advertiser.trim(),
        title: form.title.trim(),
        content: form.content.trim(),
        targetAudience: form.targetAudience.trim(),
        budget: form.budget.trim(),
        costPerView: form.costPerView.trim(),
    }));

    const onApproveAd = () => runAction("approveAd", () => approveAd(form.id.trim(), form.publisher.trim()));

    const onRecordView = () => runAction("recordView", () => recordView(form.id.trim(), form.viewer.trim()));

    const onPauseAd = () => {
        if (!confirmPause) {
            setConfirmPause(true);
            pauseTimer.current = setTimeout(() => setConfirmPause(false), 3000);
            return;
        }
        clearTimeout(pauseTimer.current);
        setConfirmPause(false);
        runAction("pauseAd", () => pauseAd(form.id.trim(), form.advertiser.trim()));
    };

    const onResumeAd = () => runAction("resumeAd", () => resumeAd(form.id.trim(), form.advertiser.trim()));

    const onGetAd = () => runAction("getAd", () => getAd(form.id.trim()));

    const onListAds = () => runAction("listAds", () => listAds());

    const onGetAdCount = () => runAction("getAdCount", async () => {
        const value = await getAdCount();
        setAdCount(String(value));
        return { count: value };
    });

    const budgetNum = Number(form.budget) || 0;
    const costNum = Number(form.costPerView) || 0;
    const spentPct = budgetNum > 0 ? Math.min(100, Math.round((costNum / budgetNum) * 100)) : 0;

    const btnClass = (actionName, extra = "") => {
        const classes = [extra];
        if (loadingAction === actionName) classes.push("btn-loading");
        return classes.filter(Boolean).join(" ");
    };

    const truncAddr = walletConnected ? `${walletState.slice(0, 6)}...${walletState.slice(-4)}` : null;

    const tabs = ["Create Campaign", "Manage", "Analytics"];

    return (
        <main className="app">
            {/* ---- Hero ---- */}
            <section className="hero">
                <div className="hero-row">
                    <span className="hero-megaphone">&#128227;</span>
                    <div className="hero-title">
                        <span className="kicker">Stellar Soroban Project 39</span>
                        <h1>Sponsored Posts</h1>
                    </div>
                </div>
                <p className="subtitle">Create ad campaigns, approve as publisher, track views and budget spend.</p>
                <div className="stat-row">
                    <span className="stat-chip">Total Ads: {adCount}</span>
                    <span className="stat-chip">Budget: {form.budget}</span>
                    <span className="stat-chip">CPV: {form.costPerView}</span>
                </div>
                <div className="budget-bar-wrapper">
                    <div className="budget-bar-label">Budget Utilization</div>
                    <div className="budget-bar-track">
                        <div className="budget-bar-fill" style={{ width: `${spentPct}%` }}></div>
                    </div>
                </div>
            </section>

            {/* ---- Wallet Bar ---- */}
            <div className="wallet-bar">
                <span className="wallet-info">
                    <span className={`wallet-dot ${walletConnected ? "connected" : "disconnected"}`}></span>
                    {walletConnected
                        ? <span className="wallet-addr" title={walletState}>{truncAddr}</span>
                        : <span>Not connected</span>
                    }
                </span>
                <button type="button" className={btnClass("connect")} onClick={onConnect} disabled={isBusy}>
                    {walletConnected ? "Reconnect" : "Connect Wallet"}
                </button>
            </div>

            {/* ---- Tab Navigation ---- */}
            <div className="tab-bar">
                {tabs.map((t, i) => (
                    <button key={t} type="button" className={`tab-btn ${activeTab === i ? "active" : ""}`} onClick={() => setActiveTab(i)}>{t}</button>
                ))}
            </div>

            {/* ---- Tab Content ---- */}
            <div className="tab-content">
                {activeTab === 0 && (
                    <section className="card full-width">
                        <div className="card-header violet-header">
                            <span className="icon">&#128640;</span>
                            <h2>Create Campaign</h2>
                        </div>
                        <div className="card-body">
                            <div className="field-group">
                                <div className="field">
                                    <label htmlFor="adId">Ad ID</label>
                                    <input id="adId" name="id" value={form.id} onChange={setField} />
                                    <span className="field-helper">Unique identifier for this ad campaign</span>
                                </div>
                                <div className="field">
                                    <label htmlFor="advertiser">Advertiser Address</label>
                                    <input id="advertiser" name="advertiser" value={form.advertiser} onChange={setField} placeholder="G..." />
                                    <span className="field-helper">Auto-filled from connected wallet</span>
                                </div>
                                <div className="field">
                                    <label htmlFor="title">Ad Title</label>
                                    <input id="title" name="title" value={form.title} onChange={setField} />
                                </div>
                                <div className="field">
                                    <label htmlFor="targetAudience">Target Audience</label>
                                    <input id="targetAudience" name="targetAudience" value={form.targetAudience} onChange={setField} />
                                    <span className="field-helper">Audience segment for ad targeting</span>
                                </div>
                                <div className="field">
                                    <label htmlFor="budget">Budget (i128)</label>
                                    <input id="budget" name="budget" value={form.budget} onChange={setField} type="number" />
                                    <span className="field-helper">Total budget for the campaign</span>
                                </div>
                                <div className="field">
                                    <label htmlFor="costPerView">Cost Per View (i128)</label>
                                    <input id="costPerView" name="costPerView" value={form.costPerView} onChange={setField} type="number" />
                                    <span className="field-helper">Amount charged per ad impression</span>
                                </div>
                                <div className="field full">
                                    <label htmlFor="content">Ad Content</label>
                                    <textarea id="content" name="content" rows="3" value={form.content} onChange={setField} />
                                </div>
                            </div>
                            <div className="btn-row">
                                <button type="button" className={btnClass("createAd")} onClick={onCreateAd} disabled={isBusy}>Launch Campaign</button>
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 1 && (
                    <section className="card full-width">
                        <div className="card-header cyan-header">
                            <span className="icon">&#9881;</span>
                            <h2>Campaign Management</h2>
                        </div>
                        <div className="card-body">
                            <div className="field-group">
                                <div className="field">
                                    <label htmlFor="publisher">Publisher Address</label>
                                    <input id="publisher" name="publisher" value={form.publisher} onChange={setField} placeholder="G..." />
                                    <span className="field-helper">Publisher who approves the ad placement</span>
                                </div>
                                <div className="field">
                                    <label htmlFor="viewer">Viewer Address</label>
                                    <input id="viewer" name="viewer" value={form.viewer} onChange={setField} placeholder="G..." />
                                    <span className="field-helper">Viewer whose impression is recorded</span>
                                </div>
                            </div>
                            <div className="btn-row">
                                <button type="button" className={`btn-success ${btnClass("approveAd")}`} onClick={onApproveAd} disabled={isBusy}>Approve</button>
                                <button type="button" className={`btn-warning ${btnClass("pauseAd")}`} onClick={onPauseAd} disabled={isBusy}>
                                    {confirmPause ? "Confirm?" : "Pause"}
                                </button>
                                <button type="button" className={`btn-cyan ${btnClass("resumeAd")}`} onClick={onResumeAd} disabled={isBusy}>Resume</button>
                                <button type="button" className={`btn-dark ${btnClass("recordView")}`} onClick={onRecordView} disabled={isBusy}>Record View</button>
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 2 && (
                    <section className="card full-width">
                        <div className="card-header dark-header">
                            <span className="icon">&#128200;</span>
                            <h2>Campaign Analytics</h2>
                        </div>
                        <div className="card-body">
                            <div className="btn-row">
                                <button type="button" className={`btn-ghost ${btnClass("getAd")}`} onClick={onGetAd} disabled={isBusy}>Get Ad</button>
                                <button type="button" className={`btn-ghost ${btnClass("listAds")}`} onClick={onListAds} disabled={isBusy}>List Ads</button>
                                <button type="button" className={btnClass("getAdCount")} onClick={onGetAdCount} disabled={isBusy}>Ad Count</button>
                            </div>
                        </div>
                    </section>
                )}

                {/* ---- Performance Log (Output) ---- */}
                <section className="output-panel full-width">
                    <div className="output-header">
                        <span>&#128202;</span>
                        <h2>Performance Log</h2>
                    </div>
                    <div className={`output-body status-${status}`}>
                        <pre id="output">{output || <span className="empty-state">Connect your wallet and perform an action to see results here.</span>}</pre>
                    </div>
                </section>
            </div>
        </main>
    );
}
