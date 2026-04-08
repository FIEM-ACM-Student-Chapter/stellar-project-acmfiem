import React, { useRef, useState } from "react";
import { checkConnection, createSubscription, renewSubscription, pauseSubscription, cancelSubscription, getSubscription, listSubscriptions, getActiveCount } from "../lib.js/stellar.js";

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
        id: "sub1",
        subscriber: "",
        planName: "Premium Learning Pass",
        billingCycle: "monthly",
        fee: "499",
        createdAt: String(nowTs()),
        expiresAt: String(nowTs() + 2592000),
    });
    const [output, setOutput] = useState("Ready to manage subscription records.");
    const [status, setStatus] = useState("idle");
    const [walletKey, setWalletKey] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState("");
    const [activeTab, setActiveTab] = useState("subscription");
    const [activeCount, setActiveCount] = useState("-");
    const [confirmCancel, setConfirmCancel] = useState(false);
    const cancelTimer = useRef(null);

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
        setForm((prev) => ({ ...prev, subscriber: prev.subscriber || user.publicKey }));
        return `Wallet: ${user.publicKey}`;
    });

    const onCreateSubscription = () => runAction("create", () => createSubscription({
        id: form.id.trim(),
        subscriber: form.subscriber.trim(),
        planName: form.planName.trim(),
        billingCycle: form.billingCycle.trim(),
        fee: form.fee.trim(),
        createdAt: form.createdAt.trim(),
        expiresAt: form.expiresAt.trim(),
    }));

    const onRenewSubscription = () => runAction("renew", () => renewSubscription({
        id: form.id.trim(),
        subscriber: form.subscriber.trim(),
        newExpiry: form.expiresAt.trim(),
    }));

    const onPauseSubscription = () => runAction("pause", () => pauseSubscription(form.id.trim(), form.subscriber.trim()));

    const onCancelSubscription = () => {
        if (confirmCancel) {
            clearTimeout(cancelTimer.current);
            setConfirmCancel(false);
            runAction("cancel", () => cancelSubscription(form.id.trim(), form.subscriber.trim()));
            return;
        }

        setConfirmCancel(true);
        cancelTimer.current = setTimeout(() => setConfirmCancel(false), 3000);
    };

    const onGetSubscription = () => runAction("get", () => getSubscription(form.id.trim()));
    const onListSubscriptions = () => runAction("list", () => listSubscriptions());
    const onGetCount = () => runAction("count", async () => {
        const value = await getActiveCount();
        setActiveCount(String(value));
        return { activeSubscriptions: value };
    });

    const btnClass = (actionName, extra = "") => [extra, loadingAction === actionName ? "btn-loading" : ""].filter(Boolean).join(" ");
    const outputClass = status === "success" ? "output-success" : status === "error" ? "output-error" : "output-idle";
    const tabs = [
        { key: "subscription", label: "Subscription" },
        { key: "lifecycle", label: "Lifecycle" },
        { key: "lookup", label: "Lookup" },
    ];

    return (
        <main className="app">
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 44</p>
                <h1>Subscription Registry</h1>
                <p className="subtitle">Track subscription plans, renewals, pauses, and cancellations with a clean on-chain workflow.</p>
                <div className="hero-stats">
                    <span className="stat-chip">Active: {activeCount}</span>
                    <span className="stat-chip">Cycle: {form.billingCycle || "-"}</span>
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

            {activeTab === "subscription" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Create Subscription</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="id">Subscription ID</label>
                                <input id="id" name="id" value={form.id} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="subscriber">Subscriber Address</label>
                                <input id="subscriber" name="subscriber" value={form.subscriber} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field">
                                <label htmlFor="planName">Plan Name</label>
                                <input id="planName" name="planName" value={form.planName} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="billingCycle">Billing Cycle</label>
                                <input id="billingCycle" name="billingCycle" value={form.billingCycle} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="fee">Fee (i128)</label>
                                <input id="fee" name="fee" value={form.fee} onChange={setField} type="number" />
                            </div>
                            <div className="field">
                                <label htmlFor="createdAt">Created At (u64)</label>
                                <input id="createdAt" name="createdAt" value={form.createdAt} onChange={setField} type="number" />
                            </div>
                            <div className="field full">
                                <label htmlFor="expiresAt">Expiry / New Expiry (u64)</label>
                                <input id="expiresAt" name="expiresAt" value={form.expiresAt} onChange={setField} type="number" />
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("create", "btn-primary")} onClick={onCreateSubscription} disabled={isBusy}>
                                Create Subscription
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === "lifecycle" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Lifecycle Actions</h2>
                    </div>
                    <div className="card-body">
                        <div className="actions">
                            <button type="button" className={btnClass("renew", "btn-primary")} onClick={onRenewSubscription} disabled={isBusy}>
                                Renew Subscription
                            </button>
                            <button type="button" className={btnClass("pause", "btn-ghost")} onClick={onPauseSubscription} disabled={isBusy}>
                                Pause Subscription
                            </button>
                            <button type="button" className={btnClass("cancel", "btn-warning")} onClick={onCancelSubscription} disabled={isBusy}>
                                {confirmCancel ? "Confirm Cancel?" : "Cancel Subscription"}
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
                            <button type="button" className={btnClass("get", "btn-ghost")} onClick={onGetSubscription} disabled={isBusy}>
                                Get Subscription
                            </button>
                            <button type="button" className={btnClass("list", "btn-ghost")} onClick={onListSubscriptions} disabled={isBusy}>
                                List Subscriptions
                            </button>
                            <button type="button" className={btnClass("count", "btn-ghost")} onClick={onGetCount} disabled={isBusy}>
                                Get Active Count
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
