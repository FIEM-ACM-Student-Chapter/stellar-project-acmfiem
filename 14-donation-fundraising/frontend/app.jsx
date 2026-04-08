import React, { useState, useRef } from "react";
import { checkConnection, createCampaign, donate, closeCampaign, getCampaign, listCampaigns, getDonorCount, getTotalRaised } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const truncateAddress = (addr) => addr && addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-6)}` : addr;

export default function App() {
    const [form, setForm] = useState({
        id: "camp1",
        organizer: "",
        title: "Help Build a School",
        description: "Fundraising to build a community school",
        goalAmount: "10000",
        deadline: String(nowTs() + 2592000),
        donor: "",
        amount: "100",
        message: "Happy to help!",
    });
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [walletState, setWalletState] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [activeTab, setActiveTab] = useState("create");
    const [confirmAction, setConfirmAction] = useState(null);
    const confirmTimer = useRef(null);

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
            setForm((prev) => ({ ...prev, organizer: user.publicKey, donor: user.publicKey }));
            return `Connected: ${user.publicKey}`;
        }
        setWalletState(null);
        return "Wallet: not connected";
    });

    const onCreateCampaign = () => runAction("createCampaign", async () => createCampaign({
        id: form.id.trim(),
        organizer: form.organizer.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        goalAmount: form.goalAmount.trim(),
        deadline: form.deadline.trim(),
    }));

    const onDonate = () => runAction("donate", async () => donate({
        campaignId: form.id.trim(),
        donor: form.donor.trim(),
        amount: form.amount.trim(),
        message: form.message.trim(),
    }));

    const handleCloseCampaign = () => {
        if (confirmAction === "closeCampaign") {
            clearTimeout(confirmTimer.current);
            setConfirmAction(null);
            runAction("closeCampaign", async () => closeCampaign({
                id: form.id.trim(),
                organizer: form.organizer.trim(),
            }));
        } else {
            setConfirmAction("closeCampaign");
            confirmTimer.current = setTimeout(() => setConfirmAction(null), 3000);
        }
    };

    const onGetCampaign = () => runAction("getCampaign", async () => getCampaign(form.id.trim()));
    const onListCampaigns = () => runAction("listCampaigns", async () => listCampaigns());
    const onGetDonorCount = () => runAction("getDonorCount", async () => {
        const count = await getDonorCount(form.id.trim());
        return { campaignId: form.id.trim(), donorCount: count };
    });
    const onGetTotalRaised = () => runAction("getTotalRaised", async () => {
        const total = await getTotalRaised(form.id.trim());
        return { campaignId: form.id.trim(), totalRaised: total };
    });

    const statusClass = status === "success" ? "output-success" : status === "error" ? "output-error" : "output-idle";

    return (
        <main className="app">
            {/* Wallet Bar */}
            <nav className="wallet-bar">
                <div className="wallet-status">
                    <span className={`status-dot ${walletState ? "connected" : "disconnected"}`} />
                    <span className="wallet-text" id="walletState">
                        {walletState ? truncateAddress(walletState) : "Not Connected"}
                    </span>
                    <span className={`wallet-badge ${walletState ? "badge-connected" : "badge-disconnected"}`}>
                        {walletState ? "Connected" : "Not Connected"}
                    </span>
                </div>
                <button
                    type="button"
                    className={`connect-btn ${loadingAction === "connect" ? "btn-loading" : ""}`}
                    id="connectWallet"
                    onClick={onConnect}
                    disabled={isBusy}
                >
                    Connect Freighter
                </button>
            </nav>

            {/* Hero */}
            <section className="hero">
                <span className="hero-icon">{"\u2764\uFE0F"}</span>
                <h1>Donation &amp; Fundraising</h1>
                <p className="subtitle">Create campaigns, accept donations, and track fundraising progress on-chain.</p>
            </section>

            {/* Tab Navigation */}
            <div className="tab-bar">
                <button
                    type="button"
                    className={`tab-btn ${activeTab === "create" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("create")}
                >
                    Create Campaign
                </button>
                <button
                    type="button"
                    className={`tab-btn ${activeTab === "donate" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("donate")}
                >
                    Donate
                </button>
                <button
                    type="button"
                    className={`tab-btn ${activeTab === "queries" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("queries")}
                >
                    Queries
                </button>
            </div>

            <div className="container">
                {/* Create Campaign Card */}
                {activeTab === "create" && (
                    <div className="card">
                        <div className="card-header">
                            <span className="card-icon">{"\u{1F3AF}"}</span>
                            <h2>Create Campaign</h2>
                        </div>

                        {/* Goal amount highlight */}
                        <div className="goal-highlight">
                            <div>
                                <div className="goal-label">Fundraising Goal</div>
                                <div className="goal-value">{Number(form.goalAmount).toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Progress bar concept */}
                        <div className="progress-bar-wrap">
                            <div className="progress-bar-fill" style={{ width: "0%" }} />
                        </div>

                        <div className="field-row">
                            <div className="field">
                                <label htmlFor="campaignId">Campaign ID</label>
                                <input id="campaignId" name="id" value={form.id} onChange={setField} />
                                <span className="helper">Unique campaign identifier</span>
                            </div>
                            <div className="field">
                                <label htmlFor="organizer">Organizer Address</label>
                                <input id="organizer" name="organizer" value={form.organizer} onChange={setField} placeholder="G..." />
                                <span className="helper">Auto-filled on wallet connect</span>
                            </div>
                        </div>

                        <div className="field">
                            <label htmlFor="title">Campaign Title</label>
                            <input id="title" name="title" value={form.title} onChange={setField} />
                            <span className="helper">A short, compelling title for your campaign</span>
                        </div>

                        <div className="field">
                            <label htmlFor="description">Description</label>
                            <textarea id="description" name="description" rows="3" value={form.description} onChange={setField} />
                            <span className="helper">Explain what the funds will be used for</span>
                        </div>

                        <div className="field-row">
                            <div className="field">
                                <label htmlFor="goalAmount">Goal Amount (i128)</label>
                                <input id="goalAmount" name="goalAmount" value={form.goalAmount} onChange={setField} type="number" />
                                <span className="helper">Target amount to raise</span>
                            </div>
                            <div className="field">
                                <label htmlFor="deadline">Deadline (u64 timestamp)</label>
                                <input id="deadline" name="deadline" value={form.deadline} onChange={setField} type="number" />
                                <span className="helper">Unix timestamp when campaign ends</span>
                            </div>
                        </div>

                        <div className="actions">
                            <button
                                type="button"
                                className={`btn-rose ${loadingAction === "createCampaign" ? "btn-loading" : ""}`}
                                onClick={onCreateCampaign}
                                disabled={isBusy}
                            >
                                Create Campaign
                            </button>
                            <button
                                type="button"
                                className={`btn-red-outline ${loadingAction === "closeCampaign" ? "btn-loading" : ""} ${confirmAction === "closeCampaign" ? "btn-confirm" : ""}`}
                                onClick={handleCloseCampaign}
                                disabled={isBusy}
                            >
                                {confirmAction === "closeCampaign" ? "Confirm Close?" : "Close Campaign"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Make a Donation Card */}
                {activeTab === "donate" && (
                    <div className="card">
                        <div className="card-header">
                            <span className="card-icon">{"\u{1F49D}"}</span>
                            <h2>Make a Donation</h2>
                        </div>

                        <div className="field">
                            <label htmlFor="donationCampaignId">Campaign ID</label>
                            <input id="donationCampaignId" name="id" value={form.id} onChange={setField} />
                            <span className="helper">ID of the campaign to donate to</span>
                        </div>

                        <div className="field">
                            <label htmlFor="donor">Donor Address</label>
                            <input id="donor" name="donor" value={form.donor} onChange={setField} placeholder="G..." />
                            <span className="helper">Auto-filled on wallet connect</span>
                        </div>

                        <div className="field-row">
                            <div className="field">
                                <label htmlFor="amount">Donation Amount (i128)</label>
                                <input id="amount" name="amount" value={form.amount} onChange={setField} type="number" />
                                <span className="helper">How much to donate</span>
                            </div>
                            <div className="field">
                                <label htmlFor="message">Message</label>
                                <input id="message" name="message" value={form.message} onChange={setField} />
                                <span className="helper">Optional message to the organizer</span>
                            </div>
                        </div>

                        <div className="actions">
                            <button
                                type="button"
                                className={`btn-rose ${loadingAction === "donate" ? "btn-loading" : ""}`}
                                onClick={onDonate}
                                disabled={isBusy}
                            >
                                Donate Now
                            </button>
                        </div>
                    </div>
                )}

                {/* Campaign Queries */}
                {activeTab === "queries" && (
                    <div className="card">
                        <div className="card-header">
                            <span className="card-icon">{"\u{1F4CB}"}</span>
                            <h2>Campaign Queries</h2>
                        </div>

                        <div className="field">
                            <label htmlFor="queryCampaignId">Campaign ID</label>
                            <input id="queryCampaignId" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Enter a campaign ID to look up</span>
                        </div>

                        <div className="query-actions">
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "getCampaign" ? "btn-loading" : ""}`}
                                onClick={onGetCampaign}
                                disabled={isBusy}
                            >
                                Get Campaign
                            </button>
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "listCampaigns" ? "btn-loading" : ""}`}
                                onClick={onListCampaigns}
                                disabled={isBusy}
                            >
                                List Campaigns
                            </button>
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "getDonorCount" ? "btn-loading" : ""}`}
                                onClick={onGetDonorCount}
                                disabled={isBusy}
                            >
                                Donor Count
                            </button>
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "getTotalRaised" ? "btn-loading" : ""}`}
                                onClick={onGetTotalRaised}
                                disabled={isBusy}
                            >
                                Total Raised
                            </button>
                        </div>
                    </div>
                )}

                {/* Activity Log */}
                <section className="activity-log">
                    <h2>{"\u{1F4AC}"} Activity Log</h2>
                    <pre id="output" className={statusClass}>
                        {output || "Connect your wallet and perform an action to see results here."}
                    </pre>
                </section>
            </div>
        </main>
    );
}
