import React, { useState } from "react";
import { checkConnection, createCampaign, registerReferral, approveReferral, issueReward, getReferral, listReferrals, getRewardCount } from "../lib.js/stellar.js";

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
        id: "campaign1",
        promoter: "",
        referrer: "",
        friend: "",
        title: "Campus Ambassador Drive",
        rewardAmount: "250",
        createdAt: String(nowTs()),
    });
    const [output, setOutput] = useState("Ready to track referral rewards.");
    const [status, setStatus] = useState("idle");
    const [walletKey, setWalletKey] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState("");
    const [activeTab, setActiveTab] = useState("campaign");
    const [rewardCount, setRewardCount] = useState("-");

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
            promoter: prev.promoter || user.publicKey,
            referrer: prev.referrer || user.publicKey,
            friend: prev.friend || user.publicKey,
        }));
        return `Wallet: ${user.publicKey}`;
    });

    const onCreateCampaign = () => runAction("create", () => createCampaign({
        id: form.id.trim(),
        promoter: form.promoter.trim(),
        title: form.title.trim(),
        rewardAmount: form.rewardAmount.trim(),
        createdAt: form.createdAt.trim(),
    }));

    const onRegisterReferral = () => runAction("register", () => registerReferral({
        id: form.id.trim(),
        referrer: form.referrer.trim(),
        friend: form.friend.trim(),
    }));

    const onApproveReferral = () => runAction("approve", () => approveReferral({
        id: form.id.trim(),
        promoter: form.promoter.trim(),
        friend: form.friend.trim(),
    }));

    const onIssueReward = () => runAction("reward", () => issueReward({
        id: form.id.trim(),
        promoter: form.promoter.trim(),
        friend: form.friend.trim(),
    }));

    const onGetReferral = () => runAction("get", () => getReferral(form.id.trim()));
    const onListReferrals = () => runAction("list", () => listReferrals());
    const onGetRewardCount = () => runAction("count", async () => {
        const value = await getRewardCount();
        setRewardCount(String(value));
        return { rewardsIssued: value };
    });

    const btnClass = (actionName, extra = "") => [extra, loadingAction === actionName ? "btn-loading" : ""].filter(Boolean).join(" ");
    const outputClass = status === "success" ? "output-success" : status === "error" ? "output-error" : "output-idle";
    const tabs = [
        { key: "campaign", label: "Campaign" },
        { key: "referrals", label: "Referrals" },
        { key: "lookup", label: "Lookup" },
    ];

    return (
        <main className="app">
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 47</p>
                <h1>Referral Rewards</h1>
                <p className="subtitle">Launch a referral drive, approve verified referrals, and mark reward issuance on-chain.</p>
                <div className="hero-stats">
                    <span className="stat-chip">Rewards Issued: {rewardCount}</span>
                    <span className="stat-chip">Reward Amount: {form.rewardAmount}</span>
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

            {activeTab === "campaign" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Create Campaign</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="id">Campaign ID</label>
                                <input id="id" name="id" value={form.id} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="promoter">Promoter Address</label>
                                <input id="promoter" name="promoter" value={form.promoter} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field full">
                                <label htmlFor="title">Campaign Title</label>
                                <input id="title" name="title" value={form.title} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="rewardAmount">Reward Amount (i128)</label>
                                <input id="rewardAmount" name="rewardAmount" value={form.rewardAmount} onChange={setField} type="number" />
                            </div>
                            <div className="field">
                                <label htmlFor="createdAt">Created At (u64)</label>
                                <input id="createdAt" name="createdAt" value={form.createdAt} onChange={setField} type="number" />
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("create", "btn-primary")} onClick={onCreateCampaign} disabled={isBusy}>
                                Create Campaign
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === "referrals" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Referral Flow</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="referrer">Referrer Address</label>
                                <input id="referrer" name="referrer" value={form.referrer} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field">
                                <label htmlFor="friend">Friend Address</label>
                                <input id="friend" name="friend" value={form.friend} onChange={setField} placeholder="G..." />
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("register", "btn-primary")} onClick={onRegisterReferral} disabled={isBusy}>
                                Register Referral
                            </button>
                            <button type="button" className={btnClass("approve", "btn-ghost")} onClick={onApproveReferral} disabled={isBusy}>
                                Approve Referral
                            </button>
                            <button type="button" className={btnClass("reward", "btn-warning")} onClick={onIssueReward} disabled={isBusy}>
                                Issue Reward
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
                            <button type="button" className={btnClass("get", "btn-ghost")} onClick={onGetReferral} disabled={isBusy}>
                                Get Campaign
                            </button>
                            <button type="button" className={btnClass("list", "btn-ghost")} onClick={onListReferrals} disabled={isBusy}>
                                List Campaigns
                            </button>
                            <button type="button" className={btnClass("count", "btn-ghost")} onClick={onGetRewardCount} disabled={isBusy}>
                                Get Reward Count
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
