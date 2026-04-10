import React, { useRef, useState } from "react";
import { checkConnection, createSession, checkIn, closeSession, getSession, listSessions, getAttendeeCount } from "../lib.js/stellar.js";

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
        id: "session1",
        organizer: "",
        participant: "",
        title: "Blockchain Workshop",
        location: "Innovation Hall",
        sessionTime: String(nowTs() + 3600),
    });
    const [output, setOutput] = useState("Ready to track attendance.");
    const [status, setStatus] = useState("idle");
    const [walletKey, setWalletKey] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState("");
    const [activeTab, setActiveTab] = useState("setup");
    const [attendeeCount, setAttendeeCount] = useState("-");
    const [confirmAction, setConfirmAction] = useState(null);
    const confirmTimer = useRef(null);

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
            organizer: prev.organizer || user.publicKey,
            participant: prev.participant || user.publicKey,
        }));
        return `Wallet: ${user.publicKey}`;
    });

    const onCreateSession = () => runAction("create", () => createSession({
        id: form.id.trim(),
        organizer: form.organizer.trim(),
        title: form.title.trim(),
        location: form.location.trim(),
        sessionTime: form.sessionTime.trim(),
    }));

    const onCheckIn = () => runAction("checkin", () => checkIn(form.id.trim(), form.participant.trim()));

    const onCloseSession = () => {
        if (confirmAction === "close") {
            clearTimeout(confirmTimer.current);
            setConfirmAction(null);
            runAction("close", () => closeSession(form.id.trim(), form.organizer.trim()));
            return;
        }

        setConfirmAction("close");
        confirmTimer.current = setTimeout(() => setConfirmAction(null), 3000);
    };

    const onGetSession = () => runAction("get", () => getSession(form.id.trim()));
    const onListSessions = () => runAction("list", () => listSessions());
    const onGetCount = () => runAction("count", async () => {
        const value = await getAttendeeCount(form.id.trim());
        setAttendeeCount(String(value));
        return { attendees: value };
    });

    const btnClass = (actionName, extra = "") => [extra, loadingAction === actionName ? "btn-loading" : ""].filter(Boolean).join(" ");
    const outputClass = status === "success" ? "output-success" : status === "error" ? "output-error" : "output-idle";
    const tabs = [
        { key: "setup", label: "Session Setup" },
        { key: "attendance", label: "Attendance" },
        { key: "lookup", label: "Lookup" },
    ];

    return (
        <main className="app">
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 40</p>
                <h1>Attendance Tracker</h1>
                <p className="subtitle">Create a session, check participants in, and keep an on-chain attendance count.</p>
                <div className="hero-stats">
                    <span className="stat-chip">Attendees: {attendeeCount}</span>
                    <span className="stat-chip">Location: {form.location || "-"}</span>
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

            {activeTab === "setup" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Create Session</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="id">Session ID</label>
                                <input id="id" name="id" value={form.id} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="organizer">Organizer Address</label>
                                <input id="organizer" name="organizer" value={form.organizer} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field">
                                <label htmlFor="title">Session Title</label>
                                <input id="title" name="title" value={form.title} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="location">Location</label>
                                <input id="location" name="location" value={form.location} onChange={setField} />
                            </div>
                            <div className="field full">
                                <label htmlFor="sessionTime">Session Time (u64 timestamp)</label>
                                <input id="sessionTime" name="sessionTime" value={form.sessionTime} onChange={setField} type="number" />
                                <span className="helper">Use a future Unix timestamp in seconds.</span>
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("create", "btn-primary")} onClick={onCreateSession} disabled={isBusy}>
                                Create Session
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === "attendance" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Attendance Workflow</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="participant">Participant Address</label>
                                <input id="participant" name="participant" value={form.participant} onChange={setField} placeholder="G..." />
                                <span className="helper">This wallet signs the on-chain check-in.</span>
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("checkin", "btn-primary")} onClick={onCheckIn} disabled={isBusy}>
                                Check In Participant
                            </button>
                            <button type="button" className={btnClass("close", "btn-warning")} onClick={onCloseSession} disabled={isBusy}>
                                {confirmAction === "close" ? "Confirm Close?" : "Close Session"}
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
                            <button type="button" className={btnClass("get", "btn-ghost")} onClick={onGetSession} disabled={isBusy}>
                                Get Session
                            </button>
                            <button type="button" className={btnClass("list", "btn-ghost")} onClick={onListSessions} disabled={isBusy}>
                                List Sessions
                            </button>
                            <button type="button" className={btnClass("count", "btn-ghost")} onClick={onGetCount} disabled={isBusy}>
                                Get Attendee Count
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
