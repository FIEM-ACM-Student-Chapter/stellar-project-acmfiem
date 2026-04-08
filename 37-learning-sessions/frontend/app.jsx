import React, { useState, useRef, useEffect } from "react";
import { checkConnection, createSession, bookSession, startSession, completeSession, cancelSession, rateSession, getSession, listSessions } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

export default function App() {
    const [form, setForm] = useState({
        id: "session1",
        tutor: "",
        student: "",
        subject: "Introduction to Stellar",
        description: "Learn the basics of Stellar smart contracts",
        sessionDate: String(nowTs() + 86400),
        durationMins: "60",
        price: "500",
        maxAttendees: "10",
        paymentAmount: "500",
        rating: "5",
    });
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [walletState, setWalletState] = useState("Wallet: not connected");
    const [walletConnected, setWalletConnected] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [activeTab, setActiveTab] = useState(0);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const cancelTimer = useRef(null);

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
                tutor: prev.tutor || addr,
                student: prev.student || addr,
            }));
            return `Wallet: ${addr}`;
        }
        setWalletState("Wallet: not connected");
        setWalletConnected(false);
        return "Wallet: not connected";
    });

    const onCreateSession = () => runAction("createSession", () => createSession({
        id: form.id.trim(),
        tutor: form.tutor.trim(),
        subject: form.subject.trim(),
        description: form.description.trim(),
        sessionDate: form.sessionDate.trim(),
        durationMins: form.durationMins.trim(),
        price: form.price.trim(),
        maxAttendees: form.maxAttendees.trim(),
    }));

    const onBookSession = () => runAction("bookSession", () => bookSession(form.id.trim(), form.student.trim(), form.paymentAmount.trim()));

    const onStartSession = () => runAction("startSession", () => startSession(form.id.trim(), form.tutor.trim()));

    const onCompleteSession = () => runAction("completeSession", () => completeSession(form.id.trim(), form.tutor.trim()));

    const onCancelSession = () => {
        if (!confirmCancel) {
            setConfirmCancel(true);
            cancelTimer.current = setTimeout(() => setConfirmCancel(false), 3000);
            return;
        }
        clearTimeout(cancelTimer.current);
        setConfirmCancel(false);
        runAction("cancelSession", () => cancelSession(form.id.trim(), form.tutor.trim()));
    };

    const onRateSession = () => runAction("rateSession", () => rateSession(form.id.trim(), form.student.trim(), form.rating.trim()));

    const onGetSession = () => runAction("getSession", () => getSession(form.id.trim()));

    const onListSessions = () => runAction("listSessions", () => listSessions());

    const starDisplay = (count) => {
        const n = Math.min(5, Math.max(0, Number(count) || 0));
        return Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="star" style={{ opacity: i < n ? 1 : 0.25 }}>&#9733;</span>
        ));
    };

    const btnClass = (actionName, extra = "") => {
        const classes = [extra];
        if (loadingAction === actionName) classes.push("btn-loading");
        return classes.filter(Boolean).join(" ");
    };

    const truncAddr = walletConnected ? `${walletState.slice(0, 6)}...${walletState.slice(-4)}` : null;

    const tabs = ["Create Session", "Book & Manage", "Browse"];

    return (
        <main className="app">
            {/* ---- Hero ---- */}
            <section className="hero">
                <div className="hero-row">
                    <span className="hero-icons">&#128197;&#128336;</span>
                    <div className="hero-title">
                        <span className="kicker">Stellar Soroban Project 37</span>
                        <h1>Learning Sessions</h1>
                    </div>
                </div>
                <p className="subtitle">Create tutoring sessions, book with payment, rate after completion.</p>
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
                        <div className="card-header">
                            <span className="icon">&#128218;</span>
                            <h2>Create Session</h2>
                        </div>
                        <div className="card-body">
                            <div className="field-group">
                                <div className="field">
                                    <label htmlFor="sessionId">Session ID</label>
                                    <input id="sessionId" name="id" value={form.id} onChange={setField} />
                                    <span className="field-helper">Unique identifier for this tutoring session</span>
                                </div>
                                <div className="field">
                                    <label htmlFor="tutor">Tutor Address</label>
                                    <input id="tutor" name="tutor" value={form.tutor} onChange={setField} placeholder="G..." />
                                    <span className="field-helper">Auto-filled from connected wallet</span>
                                </div>
                                <div className="field">
                                    <label htmlFor="subject">Subject</label>
                                    <input id="subject" name="subject" value={form.subject} onChange={setField} />
                                </div>
                                <div className="field">
                                    <label htmlFor="price">Price (i128)</label>
                                    <input id="price" name="price" value={form.price} onChange={setField} type="number" />
                                    <span className="field-helper">Cost per attendee in base units</span>
                                </div>
                                <div className="field full">
                                    <label htmlFor="description">Description</label>
                                    <textarea id="description" name="description" rows="2" value={form.description} onChange={setField} />
                                </div>
                            </div>
                            <div className="field-row-3">
                                <div className="field">
                                    <label htmlFor="sessionDate">Date (timestamp)</label>
                                    <input id="sessionDate" name="sessionDate" value={form.sessionDate} onChange={setField} type="number" />
                                </div>
                                <div className="field">
                                    <label htmlFor="durationMins">Duration (mins)</label>
                                    <input id="durationMins" name="durationMins" value={form.durationMins} onChange={setField} type="number" />
                                </div>
                                <div className="field">
                                    <label htmlFor="maxAttendees">Max Attendees</label>
                                    <input id="maxAttendees" name="maxAttendees" value={form.maxAttendees} onChange={setField} type="number" />
                                </div>
                            </div>
                            <div className="btn-row">
                                <button type="button" className={btnClass("createSession")} onClick={onCreateSession} disabled={isBusy}>Create Session</button>
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 1 && (
                    <>
                        {/* ---- Book Session ---- */}
                        <section className="card">
                            <div className="card-header">
                                <span className="icon">&#127915;</span>
                                <h2>Book Session</h2>
                            </div>
                            <div className="card-body">
                                <div className="field-group">
                                    <div className="field">
                                        <label htmlFor="student">Student Address</label>
                                        <input id="student" name="student" value={form.student} onChange={setField} placeholder="G..." />
                                        <span className="field-helper">Auto-filled from connected wallet</span>
                                    </div>
                                    <div className="field">
                                        <label htmlFor="paymentAmount">Payment Amount (i128)</label>
                                        <input id="paymentAmount" name="paymentAmount" value={form.paymentAmount} onChange={setField} type="number" />
                                    </div>
                                </div>
                                <div className="btn-row">
                                    <button type="button" className={btnClass("bookSession")} onClick={onBookSession} disabled={isBusy}>Book Now</button>
                                </div>
                            </div>
                        </section>

                        {/* ---- Session Management ---- */}
                        <section className="card">
                            <div className="card-header">
                                <span className="icon">&#9881;</span>
                                <h2>Session Management</h2>
                            </div>
                            <div className="card-body">
                                <div className="field-group">
                                    <div className="field">
                                        <label htmlFor="rating">Rating (1-5)</label>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <input id="rating" name="rating" value={form.rating} onChange={setField} type="number" min="1" max="5" style={{ width: "70px" }} />
                                            <div className="rating-field">{starDisplay(form.rating)}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="btn-row">
                                    <button type="button" className={`btn-success ${btnClass("startSession")}`} onClick={onStartSession} disabled={isBusy}>Start</button>
                                    <button type="button" className={btnClass("completeSession")} onClick={onCompleteSession} disabled={isBusy}>Complete</button>
                                    <button type="button" className={`btn-danger ${btnClass("cancelSession")}`} onClick={onCancelSession} disabled={isBusy}>
                                        {confirmCancel ? "Confirm?" : "Cancel"}
                                    </button>
                                    <button type="button" className={btnClass("rateSession")} onClick={onRateSession} disabled={isBusy}>Rate Session</button>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {activeTab === 2 && (
                    <section className="card full-width">
                        <div className="card-header">
                            <span className="icon">&#128269;</span>
                            <h2>Browse Sessions</h2>
                        </div>
                        <div className="card-body">
                            <div className="btn-row">
                                <button type="button" className={`btn-ghost ${btnClass("getSession")}`} onClick={onGetSession} disabled={isBusy}>Get Session</button>
                                <button type="button" className={`btn-ghost ${btnClass("listSessions")}`} onClick={onListSessions} disabled={isBusy}>List Sessions</button>
                            </div>
                        </div>
                    </section>
                )}

                {/* ---- Schedule Log (Output) ---- */}
                <section className="output-panel full-width">
                    <div className="output-header">
                        <span>&#128203;</span>
                        <h2>Schedule Log</h2>
                    </div>
                    <div className={`output-body status-${status}`}>
                        <pre id="output">{output || <span className="empty-state">Connect your wallet and perform an action to see results here.</span>}</pre>
                    </div>
                </section>
            </div>
        </main>
    );
}
