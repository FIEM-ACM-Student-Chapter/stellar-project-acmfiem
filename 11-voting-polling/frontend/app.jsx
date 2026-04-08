import React, { useState, useRef } from "react";
import { checkConnection, createPoll, castVote, closePoll, getResults, getPoll, listPolls, hasVoted } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const truncateAddress = (addr) => addr && addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-6)}` : addr;

export default function App() {
    const [form, setForm] = useState({
        id: "poll1",
        creator: "",
        question: "What is your favorite option?",
        optionsCount: "3",
        endTime: String(nowTs() + 86400),
        voter: "",
        optionIndex: "0",
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
            setForm((prev) => ({ ...prev, creator: user.publicKey, voter: user.publicKey }));
            return `Connected: ${user.publicKey}`;
        }
        setWalletState(null);
        return "Wallet: not connected";
    });

    const onCreatePoll = () => runAction("createPoll", async () => createPoll({
        id: form.id.trim(),
        creator: form.creator.trim(),
        question: form.question.trim(),
        optionsCount: form.optionsCount.trim(),
        endTime: form.endTime.trim(),
    }));

    const onCastVote = () => runAction("castVote", async () => castVote({
        pollId: form.id.trim(),
        voter: form.voter.trim(),
        optionIndex: form.optionIndex.trim(),
    }));

    const handleClosePoll = () => {
        if (confirmAction === "closePoll") {
            clearTimeout(confirmTimer.current);
            setConfirmAction(null);
            runAction("closePoll", async () => closePoll({
                pollId: form.id.trim(),
                creator: form.creator.trim(),
            }));
        } else {
            setConfirmAction("closePoll");
            confirmTimer.current = setTimeout(() => setConfirmAction(null), 3000);
        }
    };

    const onGetResults = () => runAction("getResults", async () => getResults(form.id.trim()));
    const onGetPoll = () => runAction("getPoll", async () => getPoll(form.id.trim()));
    const onListPolls = () => runAction("listPolls", async () => listPolls());
    const onHasVoted = () => runAction("hasVoted", async () => {
        const voted = await hasVoted(form.id.trim(), form.voter.trim());
        return { hasVoted: voted };
    });

    const statusClass = status === "success" ? "output-success" : status === "error" ? "output-error" : "output-idle";

    return (
        <main className="app">
            {/* Wallet Status Bar */}
            <nav className="top-bar">
                <div className="wallet-status">
                    <span className={`status-dot ${walletState ? "connected" : "disconnected"}`} />
                    <span className="wallet-info" id="walletState">
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
                <span className="hero-icon">{"\u{1F5F3}"}</span>
                <h1>Voting &amp; Polling System</h1>
                <p className="subtitle">Create polls, cast votes, and view results on-chain.</p>
            </section>

            {/* Tab Navigation */}
            <div className="tab-bar">
                <button
                    type="button"
                    className={`tab-btn ${activeTab === "create" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("create")}
                >
                    Create Poll
                </button>
                <button
                    type="button"
                    className={`tab-btn ${activeTab === "vote" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("vote")}
                >
                    Vote
                </button>
                <button
                    type="button"
                    className={`tab-btn ${activeTab === "results" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("results")}
                >
                    Results
                </button>
            </div>

            {/* Main Grid */}
            <div className="main-grid">
                {/* Create Poll Card */}
                {activeTab === "create" && (
                    <div className="card">
                        <div className="card-header">
                            <span className="card-icon">{"\u{1F4CB}"}</span>
                            <h2>Create Poll</h2>
                        </div>

                        <div className="field">
                            <label htmlFor="pollId">Poll ID (Symbol)</label>
                            <input id="pollId" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Unique identifier for this poll (e.g., "poll1")</span>
                        </div>

                        <div className="field">
                            <label htmlFor="creator">Creator Address</label>
                            <input id="creator" name="creator" value={form.creator} onChange={setField} placeholder="G..." />
                            <span className="helper">Auto-filled when wallet is connected</span>
                        </div>

                        <div className="field">
                            <label htmlFor="question">Question</label>
                            <input id="question" name="question" value={form.question} onChange={setField} />
                            <span className="helper">The question voters will answer</span>
                        </div>

                        <div className="field-row">
                            <div className="field">
                                <label htmlFor="optionsCount">Options Count</label>
                                <input id="optionsCount" name="optionsCount" value={form.optionsCount} onChange={setField} type="number" />
                                <span className="helper">Number of voting options</span>
                            </div>
                            <div className="field">
                                <label htmlFor="endTime">End Time (u64)</label>
                                <input id="endTime" name="endTime" value={form.endTime} onChange={setField} type="number" />
                                <span className="helper">Unix timestamp when poll closes</span>
                            </div>
                        </div>

                        <div className="actions">
                            <button
                                type="button"
                                className={`btn-primary ${loadingAction === "createPoll" ? "btn-loading" : ""}`}
                                onClick={onCreatePoll}
                                disabled={isBusy}
                            >
                                Create Poll
                            </button>
                            <button
                                type="button"
                                className={`btn-red-outline ${loadingAction === "closePoll" ? "btn-loading" : ""} ${confirmAction === "closePoll" ? "btn-confirm" : ""}`}
                                onClick={handleClosePoll}
                                disabled={isBusy}
                            >
                                {confirmAction === "closePoll" ? "Confirm?" : "Close Poll"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Cast Your Vote Card */}
                {activeTab === "vote" && (
                    <div className="card">
                        <div className="card-header">
                            <span className="card-icon">{"\u2705"}</span>
                            <h2>Cast Your Vote</h2>
                        </div>

                        <div className="field">
                            <label htmlFor="pollIdVote">Poll ID</label>
                            <input id="pollIdVote" name="id" value={form.id} onChange={setField} />
                            <span className="helper">ID of the poll you want to vote on</span>
                        </div>

                        <div className="field">
                            <label htmlFor="voter">Voter Address</label>
                            <input id="voter" name="voter" value={form.voter} onChange={setField} placeholder="G..." />
                            <span className="helper">Auto-filled when wallet is connected</span>
                        </div>

                        <div className="field">
                            <label htmlFor="optionIndex">Option Index (0-based)</label>
                            <input id="optionIndex" name="optionIndex" value={form.optionIndex} onChange={setField} type="number" />
                            <span className="helper">Choose which option to vote for (starts at 0)</span>
                        </div>

                        <div className="actions">
                            <button
                                type="button"
                                className={`btn-ballot ${loadingAction === "castVote" ? "btn-loading" : ""}`}
                                onClick={onCastVote}
                                disabled={isBusy}
                            >
                                Cast Vote
                            </button>
                        </div>
                    </div>
                )}

                {/* Results & Queries Card */}
                {activeTab === "results" && (
                    <div className="card">
                        <div className="card-header">
                            <span className="card-icon">{"\u{1F4CA}"}</span>
                            <h2>Results &amp; Queries</h2>
                        </div>

                        <div className="field">
                            <label htmlFor="pollIdQuery">Poll ID</label>
                            <input id="pollIdQuery" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Enter the poll ID to query</span>
                        </div>

                        <div className="query-actions">
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "getResults" ? "btn-loading" : ""}`}
                                onClick={onGetResults}
                                disabled={isBusy}
                            >
                                Get Results
                            </button>
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "hasVoted" ? "btn-loading" : ""}`}
                                onClick={onHasVoted}
                                disabled={isBusy}
                            >
                                Has Voted?
                            </button>
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "getPoll" ? "btn-loading" : ""}`}
                                onClick={onGetPoll}
                                disabled={isBusy}
                            >
                                Get Poll
                            </button>
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "listPolls" ? "btn-loading" : ""}`}
                                onClick={onListPolls}
                                disabled={isBusy}
                            >
                                List Polls
                            </button>
                        </div>
                    </div>
                )}

                {/* Vote Tally Output */}
                <section className="output-section">
                    <h2>{"\u{1F4E5}"} Vote Tally</h2>
                    <pre id="output" className={statusClass}>
                        {output || "Connect your wallet and perform an action to see results here."}
                    </pre>
                </section>
            </div>
        </main>
    );
}
