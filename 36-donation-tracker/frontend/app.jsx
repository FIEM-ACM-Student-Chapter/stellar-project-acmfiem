import React, { useState, useRef, useEffect } from "react";
import { checkConnection, createCause, donateToCause, getCause, listCauses, getDonorTotal, getTopDonation, getCauseCount } from "../lib.js/stellar.js";

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

export default function App() {
    const [form, setForm] = useState({
        id: "cause1",
        organizer: "",
        name: "Community Garden",
        description: "Fund a local community garden",
        goalAmount: "10000",
        donor: "",
        donationAmount: "500",
        donationMessage: "Happy to help!",
    });
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [walletState, setWalletState] = useState("Wallet: not connected");
    const [walletConnected, setWalletConnected] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [causeCount, setCauseCount] = useState("-");
    const [activeTab, setActiveTab] = useState(0);

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
                organizer: prev.organizer || addr,
                donor: prev.donor || addr,
            }));
            return `Wallet: ${addr}`;
        }
        setWalletState("Wallet: not connected");
        setWalletConnected(false);
        return "Wallet: not connected";
    });

    const onCreateCause = () => runAction("createCause", () => createCause({
        id: form.id.trim(),
        organizer: form.organizer.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        goalAmount: form.goalAmount.trim(),
    }));

    const onDonate = () => runAction("donate", () => donateToCause({
        causeId: form.id.trim(),
        donor: form.donor.trim(),
        amount: form.donationAmount.trim(),
        message: form.donationMessage.trim(),
    }));

    const onGetCause = () => runAction("getCause", () => getCause(form.id.trim()));

    const onListCauses = () => runAction("listCauses", () => listCauses());

    const onGetDonorTotal = () => runAction("getDonorTotal", () => getDonorTotal(form.id.trim(), form.donor.trim()));

    const onGetTopDonation = () => runAction("getTopDonation", () => getTopDonation(form.id.trim()));

    const onGetCount = () => runAction("getCount", async () => {
        const value = await getCauseCount();
        setCauseCount(String(value));
        return { count: value };
    });

    const btnClass = (actionName, extra = "") => {
        const classes = [extra];
        if (loadingAction === actionName) classes.push("btn-loading");
        return classes.filter(Boolean).join(" ");
    };

    const truncAddr = walletConnected ? `${walletState.slice(0, 6)}...${walletState.slice(-4)}` : null;

    const tabs = ["Create Cause", "Donate", "Leaderboard"];

    return (
        <main className="app">
            {/* ---- Hero ---- */}
            <section className="hero">
                <span className="kicker">Stellar Soroban Project 36</span>
                <span className="hero-icon">&#127942;</span>
                <h1>Donation Tracker</h1>
                <p className="subtitle">Create causes, donate, and track fundraising progress with a leaderboard.</p>
                <span className="stat-badge">Total Causes: {causeCount}</span>
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
                        <div className="card-header gold-header">
                            <span className="icon">&#127941;</span>
                            <h2>Create Cause</h2>
                        </div>
                        <div className="card-body">
                            <div className="field-group">
                                <div className="field">
                                    <label htmlFor="causeId">Cause ID</label>
                                    <input id="causeId" name="id" value={form.id} onChange={setField} />
                                    <span className="field-helper">Unique identifier for this fundraising cause</span>
                                </div>
                                <div className="field">
                                    <label htmlFor="organizer">Organizer Address</label>
                                    <input id="organizer" name="organizer" value={form.organizer} onChange={setField} placeholder="G..." />
                                    <span className="field-helper">Auto-filled from connected wallet</span>
                                </div>
                                <div className="field">
                                    <label htmlFor="name">Cause Name</label>
                                    <input id="name" name="name" value={form.name} onChange={setField} />
                                </div>
                                <div className="field">
                                    <label htmlFor="goalAmount">Goal Amount (i128)</label>
                                    <input id="goalAmount" name="goalAmount" value={form.goalAmount} onChange={setField} type="number" />
                                    <span className="field-helper">Target fundraising goal in base units</span>
                                </div>
                                <div className="field full">
                                    <label htmlFor="description">Description</label>
                                    <textarea id="description" name="description" rows="2" value={form.description} onChange={setField} />
                                </div>
                            </div>
                            <div className="btn-row">
                                <button type="button" className={btnClass("createCause")} onClick={onCreateCause} disabled={isBusy}>Create Cause</button>
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 1 && (
                    <section className="card full-width">
                        <div className="card-header silver-header">
                            <span className="icon">&#128176;</span>
                            <h2>Make a Donation</h2>
                        </div>
                        <div className="card-body">
                            <div className="field-group">
                                <div className="field">
                                    <label htmlFor="donor">Donor Address</label>
                                    <input id="donor" name="donor" value={form.donor} onChange={setField} placeholder="G..." />
                                    <span className="field-helper">Auto-filled from connected wallet</span>
                                </div>
                                <div className="field">
                                    <label htmlFor="donationAmount">Amount (i128)</label>
                                    <input id="donationAmount" name="donationAmount" value={form.donationAmount} onChange={setField} type="number" />
                                    <span className="field-helper">Amount to donate in base units</span>
                                </div>
                                <div className="field full">
                                    <label htmlFor="donationMessage">Donation Message</label>
                                    <input id="donationMessage" name="donationMessage" value={form.donationMessage} onChange={setField} />
                                </div>
                            </div>
                            <div className="btn-row">
                                <button type="button" className={`btn-silver ${btnClass("donate")}`} onClick={onDonate} disabled={isBusy}>Donate Now</button>
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 2 && (
                    <section className="card full-width">
                        <div className="card-header bronze-header">
                            <span className="icon">&#128202;</span>
                            <h2>Leaderboard Queries</h2>
                        </div>
                        <div className="card-body">
                            <div className="btn-row">
                                <button type="button" className={btnClass("getDonorTotal")} onClick={onGetDonorTotal} disabled={isBusy}>Donor Total</button>
                                <button type="button" className={btnClass("getTopDonation")} onClick={onGetTopDonation} disabled={isBusy}>Top Donation</button>
                                <button type="button" className={`btn-silver ${btnClass("getCause")}`} onClick={onGetCause} disabled={isBusy}>Get Cause</button>
                                <button type="button" className={`btn-ghost ${btnClass("listCauses")}`} onClick={onListCauses} disabled={isBusy}>List Causes</button>
                                <button type="button" className={`btn-bronze ${btnClass("getCount")}`} onClick={onGetCount} disabled={isBusy}>Cause Count</button>
                            </div>
                        </div>
                    </section>
                )}

                {/* ---- Tracker Feed (Output) ---- */}
                <section className="output-panel full-width">
                    <div className="output-header">
                        <span>&#127942;</span>
                        <h2>Tracker Feed</h2>
                    </div>
                    <div className={`output-body status-${status}`}>
                        <pre id="output">{output || <span className="empty-state">Connect your wallet and perform an action to see results here.</span>}</pre>
                    </div>
                </section>
            </div>
        </main>
    );
}
