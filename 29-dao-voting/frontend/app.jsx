import React, { useState, useRef, useEffect } from "react";
import { checkConnection, createProposal, castVote, executeProposal, vetoProposal, getProposal, listProposals, hasVoted, getProposalCount } from "../lib.js/stellar.js";

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const truncateAddress = (addr) => {
    if (!addr || addr.length < 12) return addr;
    return addr.slice(0, 6) + "..." + addr.slice(-4);
};

export default function App() {
    const [form, setForm] = useState({
        id: "prop1",
        proposer: "",
        title: "Fund ecosystem grants",
        description: "Allocate 10000 XLM for developer grants",
        category: "treasury",
        votingPeriod: "604800",
        voter: "",
        votePower: "100",
        inFavor: true,
        executor: "",
        vetoer: "",
    });
    const [output, setOutput] = useState("");
    const [walletState, setWalletState] = useState("Wallet: not connected");
    const [isBusy, setIsBusy] = useState(false);
    const [countValue, setCountValue] = useState("-");
    const [loadingAction, setLoadingAction] = useState(null);
    const [status, setStatus] = useState("idle");
    const [activeTab, setActiveTab] = useState(0);
    const [connectedAddress, setConnectedAddress] = useState("");
    const [confirmAction, setConfirmAction] = useState(null);
    const confirmTimer = useRef(null);

    useEffect(() => {
        return () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); };
    }, []);

    const setField = (event) => {
        const { name, value, type, checked } = event.target;
        setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    };

    const setInFavor = (value) => {
        setForm((prev) => ({ ...prev, inFavor: value }));
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

    const handleConfirm = (actionName, action) => {
        if (confirmAction === actionName) {
            setConfirmAction(null);
            if (confirmTimer.current) clearTimeout(confirmTimer.current);
            action();
        } else {
            setConfirmAction(actionName);
            if (confirmTimer.current) clearTimeout(confirmTimer.current);
            confirmTimer.current = setTimeout(() => setConfirmAction(null), 3000);
        }
    };

    const onConnect = () => runAction("connect", async () => {
        const user = await checkConnection();
        const nextWalletState = user ? `Wallet: ${user.publicKey}` : "Wallet: not connected";
        setWalletState(nextWalletState);
        if (user) {
            setConnectedAddress(user.publicKey);
            setForm((prev) => ({
                ...prev,
                proposer: prev.proposer || user.publicKey,
                voter: prev.voter || user.publicKey,
                executor: prev.executor || user.publicKey,
                vetoer: prev.vetoer || user.publicKey,
            }));
        }
        return nextWalletState;
    });

    const onCreateProposal = () => runAction("createProposal", async () => createProposal({
        id: form.id.trim(),
        proposer: form.proposer.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        votingPeriod: form.votingPeriod.trim(),
    }));

    const onCastVote = () => runAction("castVote", async () => castVote({
        proposalId: form.id.trim(),
        voter: form.voter.trim(),
        votePower: form.votePower.trim(),
        inFavor: form.inFavor,
    }));

    const onExecute = () => runAction("execute", async () => executeProposal({
        id: form.id.trim(),
        executor: form.executor.trim() || form.proposer.trim(),
    }));

    const onVeto = () => handleConfirm("veto", () => runAction("veto", async () => vetoProposal({
        id: form.id.trim(),
        vetoer: form.vetoer.trim() || form.proposer.trim(),
    })));

    const onGetProposal = () => runAction("getProposal", async () => getProposal(form.id.trim()));

    const onList = () => runAction("list", async () => listProposals());

    const onHasVoted = () => runAction("hasVoted", async () => {
        const value = await hasVoted(form.id.trim(), form.voter.trim());
        return { hasVoted: value };
    });

    const onCount = () => runAction("count", async () => {
        const value = await getProposalCount();
        setCountValue(String(value));
        return { count: value };
    });

    const tabs = ["Submit Proposal", "Vote", "Governance"];

    return (
        <main className="app">
            {/* ---- Wallet Status Bar ---- */}
            <div className="wallet-status-bar">
                <span className={`wallet-dot ${connectedAddress ? "connected" : ""}`} />
                <span className="wallet-status-text">
                    {connectedAddress ? truncateAddress(connectedAddress) : "Not connected"}
                </span>
            </div>

            {/* ---- Hero ---- */}
            <section className="hero">
                <div className="hero-icon">&#9878;</div>
                <h1>DAO Governance</h1>
                <p className="subtitle">Submit proposals, cast weighted votes, and execute governance decisions on Stellar.</p>

                <div className="wallet-bar">
                    <button type="button" id="connectWallet" onClick={onConnect} className={loadingAction === "connect" ? "btn-loading" : ""} disabled={isBusy}>
                        Connect Freighter
                    </button>
                    <span className="wallet-text" id="walletState">{walletState}</span>
                </div>

                <p className="proposal-count">
                    Active proposals: <span>{countValue}</span>
                </p>
            </section>

            {/* ---- Tab Navigation ---- */}
            <div className="tab-bar">
                {tabs.map((tab, i) => (
                    <button
                        key={tab}
                        type="button"
                        className={`tab-btn ${activeTab === i ? "active" : ""}`}
                        onClick={() => setActiveTab(i)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* ---- Tab 0: Submit Proposal ---- */}
            {activeTab === 0 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#128220;</span>
                        <h2>Submit Proposal</h2>
                    </div>
                    <div className="card-body">
                        <div className="form-grid">
                            <div className="field">
                                <label htmlFor="id">Proposal ID (Symbol)</label>
                                <input id="id" name="id" value={form.id} onChange={setField} />
                                <span className="field-helper">Unique proposal identifier</span>
                            </div>
                            <div className="field">
                                <label htmlFor="proposer">Proposer Address</label>
                                <input id="proposer" name="proposer" value={form.proposer} onChange={setField} placeholder="G..." />
                                <span className="field-helper">Auto-filled on wallet connect</span>
                            </div>
                            <div className="field full-width">
                                <label htmlFor="title">Title</label>
                                <input id="title" name="title" value={form.title} onChange={setField} />
                            </div>
                            <div className="field full-width">
                                <label htmlFor="description">Description</label>
                                <textarea id="description" name="description" rows="3" value={form.description} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="category">Category (Symbol)</label>
                                <input id="category" name="category" value={form.category} onChange={setField} />
                                <span className="field-helper">e.g. treasury, protocol, membership</span>
                            </div>
                            <div className="field">
                                <label htmlFor="votingPeriod">Voting Period (seconds)</label>
                                <input id="votingPeriod" name="votingPeriod" value={form.votingPeriod} onChange={setField} type="number" />
                                <span className="field-helper">604800 = 7 days</span>
                            </div>
                        </div>

                        <div className="actions">
                            <button type="button" className={`btn ${loadingAction === "createProposal" ? "btn-loading" : ""}`} onClick={onCreateProposal} disabled={isBusy}>Submit Proposal</button>
                        </div>
                    </div>
                </section>
            )}

            {/* ---- Tab 1: Vote ---- */}
            {activeTab === 1 && (
                <section className="card vote-card">
                    <div className="card-header">
                        <span className="card-icon">&#9878;</span>
                        <h2>Cast Your Vote</h2>
                    </div>
                    <div className="card-body">
                        <div className="form-grid">
                            <div className="field">
                                <label htmlFor="voter">Voter Address</label>
                                <input id="voter" name="voter" value={form.voter} onChange={setField} placeholder="G..." />
                                <span className="field-helper">Your Stellar address</span>
                            </div>
                            <div className="field">
                                <label htmlFor="votePower">Vote Power (i128)</label>
                                <input id="votePower" name="votePower" value={form.votePower} onChange={setField} type="number" />
                                <span className="field-helper">Weight of your vote</span>
                            </div>
                            <div className="field full-width">
                                <label>Your Position</label>
                                <div className="vote-toggle">
                                    <button
                                        type="button"
                                        className={`vote-toggle-btn vote-for ${form.inFavor ? "active" : ""}`}
                                        onClick={() => setInFavor(true)}
                                    >
                                        &#10003; FOR
                                    </button>
                                    <button
                                        type="button"
                                        className={`vote-toggle-btn vote-against ${!form.inFavor ? "active" : ""}`}
                                        onClick={() => setInFavor(false)}
                                    >
                                        &#10007; AGAINST
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="actions">
                            <button type="button" className={`btn ${loadingAction === "castVote" ? "btn-loading" : ""}`} onClick={onCastVote} disabled={isBusy}>Cast Vote</button>
                        </div>
                    </div>
                </section>
            )}

            {/* ---- Tab 2: Governance ---- */}
            {activeTab === 2 && (
                <>
                    <section className="card">
                        <div className="card-header">
                            <span className="card-icon">&#128736;</span>
                            <h2>Governance Actions</h2>
                        </div>
                        <div className="card-body">
                            <div className="form-grid">
                                <div className="field">
                                    <label htmlFor="executor">Executor Address (optional)</label>
                                    <input id="executor" name="executor" value={form.executor} onChange={setField} placeholder="G..." />
                                </div>
                                <div className="field">
                                    <label htmlFor="vetoer">Vetoer Address (optional)</label>
                                    <input id="vetoer" name="vetoer" value={form.vetoer} onChange={setField} placeholder="G..." />
                                </div>
                            </div>

                            <div className="actions">
                                <button type="button" className={`btn ${loadingAction === "execute" ? "btn-loading" : ""}`} onClick={onExecute} disabled={isBusy}>Execute Proposal</button>
                                <button
                                    type="button"
                                    className={`btn btn-danger ${loadingAction === "veto" ? "btn-loading" : ""}`}
                                    onClick={onVeto}
                                    disabled={isBusy}
                                >
                                    {confirmAction === "veto" ? "Confirm Veto?" : "Veto Proposal"}
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="card">
                        <div className="card-header">
                            <span className="card-icon">&#128218;</span>
                            <h2>Proposal Registry</h2>
                        </div>
                        <div className="card-body">
                            <div className="actions">
                                <button type="button" className={`btn btn-ghost ${loadingAction === "getProposal" ? "btn-loading" : ""}`} onClick={onGetProposal} disabled={isBusy}>Get Proposal</button>
                                <button type="button" className={`btn btn-ghost ${loadingAction === "list" ? "btn-loading" : ""}`} onClick={onList} disabled={isBusy}>List Proposals</button>
                                <button type="button" className={`btn btn-ghost ${loadingAction === "hasVoted" ? "btn-loading" : ""}`} onClick={onHasVoted} disabled={isBusy}>Has Voted?</button>
                                <button type="button" className={`btn btn-ghost ${loadingAction === "count" ? "btn-loading" : ""}`} onClick={onCount} disabled={isBusy}>Get Count</button>
                            </div>
                        </div>
                    </section>
                </>
            )}

            {/* ---- Output ---- */}
            <section className="card output-card">
                <div className="card-header">
                    <span className="card-icon">&#128196;</span>
                    <h2>Result</h2>
                </div>
                <div className="card-body">
                    <pre id="output" className={`output-pre status-${status}`}>
                        {output || "Connect your wallet to participate in governance. Proposal data and vote results will appear here."}
                    </pre>
                </div>
            </section>
        </main>
    );
}
