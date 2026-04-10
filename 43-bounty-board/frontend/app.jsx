import React, { useRef, useState } from "react";
import { checkConnection, createBounty, assignBounty, submitBounty, approveBounty, closeBounty, getBounty, listBounties } from "../lib.js/stellar.js";

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
        id: "bounty1",
        creator: "",
        worker: "",
        title: "Design community landing page",
        description: "Build a responsive landing page for the neighborhood portal.",
        reward: "1500",
        createdAt: String(nowTs()),
    });
    const [output, setOutput] = useState("Ready to manage bounties.");
    const [status, setStatus] = useState("idle");
    const [walletKey, setWalletKey] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState("");
    const [activeTab, setActiveTab] = useState("bounty");
    const [confirmClose, setConfirmClose] = useState(false);
    const closeTimer = useRef(null);

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
            creator: prev.creator || user.publicKey,
            worker: prev.worker || user.publicKey,
        }));
        return `Wallet: ${user.publicKey}`;
    });

    const onCreateBounty = () => runAction("create", () => createBounty({
        id: form.id.trim(),
        creator: form.creator.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        reward: form.reward.trim(),
        createdAt: form.createdAt.trim(),
    }));

    const onAssignBounty = () => runAction("assign", () => assignBounty({
        id: form.id.trim(),
        creator: form.creator.trim(),
        worker: form.worker.trim(),
    }));

    const onSubmitBounty = () => runAction("submit", () => submitBounty(form.id.trim(), form.worker.trim()));
    const onApproveBounty = () => runAction("approve", () => approveBounty(form.id.trim(), form.creator.trim()));

    const onCloseBounty = () => {
        if (confirmClose) {
            clearTimeout(closeTimer.current);
            setConfirmClose(false);
            runAction("close", () => closeBounty(form.id.trim(), form.creator.trim()));
            return;
        }

        setConfirmClose(true);
        closeTimer.current = setTimeout(() => setConfirmClose(false), 3000);
    };

    const onGetBounty = () => runAction("get", () => getBounty(form.id.trim()));
    const onListBounties = () => runAction("list", () => listBounties());

    const btnClass = (actionName, extra = "") => [extra, loadingAction === actionName ? "btn-loading" : ""].filter(Boolean).join(" ");
    const outputClass = status === "success" ? "output-success" : status === "error" ? "output-error" : "output-idle";
    const tabs = [
        { key: "bounty", label: "Bounty" },
        { key: "workflow", label: "Workflow" },
        { key: "lookup", label: "Lookup" },
    ];

    return (
        <main className="app">
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 46</p>
                <h1>Bounty Board</h1>
                <p className="subtitle">Post work, assign a contributor, submit completion, and approve the bounty lifecycle on Stellar.</p>
                <div className="hero-stats">
                    <span className="stat-chip">Reward: {form.reward}</span>
                    <span className="stat-chip">Worker Ready: {form.worker ? "Yes" : "No"}</span>
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

            {activeTab === "bounty" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Create Bounty</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="id">Bounty ID</label>
                                <input id="id" name="id" value={form.id} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="creator">Creator Address</label>
                                <input id="creator" name="creator" value={form.creator} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field">
                                <label htmlFor="worker">Worker Address</label>
                                <input id="worker" name="worker" value={form.worker} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field">
                                <label htmlFor="reward">Reward (i128)</label>
                                <input id="reward" name="reward" value={form.reward} onChange={setField} type="number" />
                            </div>
                            <div className="field full">
                                <label htmlFor="title">Title</label>
                                <input id="title" name="title" value={form.title} onChange={setField} />
                            </div>
                            <div className="field full">
                                <label htmlFor="description">Description</label>
                                <textarea id="description" name="description" rows="3" value={form.description} onChange={setField} />
                            </div>
                            <div className="field full">
                                <label htmlFor="createdAt">Created At (u64)</label>
                                <input id="createdAt" name="createdAt" value={form.createdAt} onChange={setField} type="number" />
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("create", "btn-primary")} onClick={onCreateBounty} disabled={isBusy}>
                                Create Bounty
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === "workflow" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Workflow</h2>
                    </div>
                    <div className="card-body">
                        <div className="actions">
                            <button type="button" className={btnClass("assign", "btn-primary")} onClick={onAssignBounty} disabled={isBusy}>
                                Assign Worker
                            </button>
                            <button type="button" className={btnClass("submit", "btn-ghost")} onClick={onSubmitBounty} disabled={isBusy}>
                                Submit Work
                            </button>
                            <button type="button" className={btnClass("approve", "btn-ghost")} onClick={onApproveBounty} disabled={isBusy}>
                                Approve Bounty
                            </button>
                            <button type="button" className={btnClass("close", "btn-warning")} onClick={onCloseBounty} disabled={isBusy}>
                                {confirmClose ? "Confirm Close?" : "Close Bounty"}
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
                            <button type="button" className={btnClass("get", "btn-ghost")} onClick={onGetBounty} disabled={isBusy}>
                                Get Bounty
                            </button>
                            <button type="button" className={btnClass("list", "btn-ghost")} onClick={onListBounties} disabled={isBusy}>
                                List Bounties
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
