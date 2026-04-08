import React, { useState } from "react";
import { checkConnection, createMember, addPoints, redeemPoints, updateTier, getMember, listMembers, getMemberCount } from "../lib.js/stellar.js";

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
        id: "member1",
        owner: "",
        name: "Aisha Khan",
        tier: "silver",
        joinedAt: String(nowTs()),
        amount: "25",
    });
    const [output, setOutput] = useState("Ready to manage loyalty rewards.");
    const [status, setStatus] = useState("idle");
    const [walletKey, setWalletKey] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState("");
    const [activeTab, setActiveTab] = useState("member");
    const [memberCount, setMemberCount] = useState("-");

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
        setForm((prev) => ({ ...prev, owner: prev.owner || user.publicKey }));
        return `Wallet: ${user.publicKey}`;
    });

    const onCreateMember = () => runAction("create", () => createMember({
        id: form.id.trim(),
        owner: form.owner.trim(),
        name: form.name.trim(),
        tier: form.tier.trim(),
        joinedAt: form.joinedAt.trim(),
    }));

    const onAddPoints = () => runAction("add", () => addPoints({
        id: form.id.trim(),
        owner: form.owner.trim(),
        amount: form.amount.trim(),
    }));

    const onRedeemPoints = () => runAction("redeem", () => redeemPoints({
        id: form.id.trim(),
        owner: form.owner.trim(),
        amount: form.amount.trim(),
    }));

    const onUpdateTier = () => runAction("tier", () => updateTier({
        id: form.id.trim(),
        owner: form.owner.trim(),
        tier: form.tier.trim(),
    }));

    const onGetMember = () => runAction("get", () => getMember(form.id.trim()));
    const onListMembers = () => runAction("list", () => listMembers());
    const onGetCount = () => runAction("count", async () => {
        const value = await getMemberCount();
        setMemberCount(String(value));
        return { members: value };
    });

    const btnClass = (actionName, extra = "") => [extra, loadingAction === actionName ? "btn-loading" : ""].filter(Boolean).join(" ");
    const outputClass = status === "success" ? "output-success" : status === "error" ? "output-error" : "output-idle";
    const tabs = [
        { key: "member", label: "Member" },
        { key: "rewards", label: "Rewards" },
        { key: "lookup", label: "Lookup" },
    ];

    return (
        <main className="app">
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 41</p>
                <h1>Loyalty Rewards</h1>
                <p className="subtitle">Create member accounts, adjust points, and manage loyalty tiers on-chain.</p>
                <div className="hero-stats">
                    <span className="stat-chip">Members: {memberCount}</span>
                    <span className="stat-chip">Tier: {form.tier || "-"}</span>
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

            {activeTab === "member" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Create Member</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="id">Member ID</label>
                                <input id="id" name="id" value={form.id} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="owner">Owner Address</label>
                                <input id="owner" name="owner" value={form.owner} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field">
                                <label htmlFor="name">Name</label>
                                <input id="name" name="name" value={form.name} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="tier">Tier</label>
                                <input id="tier" name="tier" value={form.tier} onChange={setField} placeholder="bronze, silver, gold" />
                            </div>
                            <div className="field full">
                                <label htmlFor="joinedAt">Joined At (u64 timestamp)</label>
                                <input id="joinedAt" name="joinedAt" value={form.joinedAt} onChange={setField} type="number" />
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("create", "btn-primary")} onClick={onCreateMember} disabled={isBusy}>
                                Create Member
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === "rewards" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Reward Actions</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="amount">Points Amount (i128)</label>
                                <input id="amount" name="amount" value={form.amount} onChange={setField} type="number" />
                            </div>
                            <div className="field">
                                <label htmlFor="tierRewards">Tier Label</label>
                                <input id="tierRewards" name="tier" value={form.tier} onChange={setField} />
                                <span className="helper">Use this field to update the member tier.</span>
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("add", "btn-primary")} onClick={onAddPoints} disabled={isBusy}>
                                Add Points
                            </button>
                            <button type="button" className={btnClass("redeem", "btn-warning")} onClick={onRedeemPoints} disabled={isBusy}>
                                Redeem Points
                            </button>
                            <button type="button" className={btnClass("tier", "btn-ghost")} onClick={onUpdateTier} disabled={isBusy}>
                                Update Tier
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
                            <button type="button" className={btnClass("get", "btn-ghost")} onClick={onGetMember} disabled={isBusy}>
                                Get Member
                            </button>
                            <button type="button" className={btnClass("list", "btn-ghost")} onClick={onListMembers} disabled={isBusy}>
                                List Members
                            </button>
                            <button type="button" className={btnClass("count", "btn-ghost")} onClick={onGetCount} disabled={isBusy}>
                                Get Member Count
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
