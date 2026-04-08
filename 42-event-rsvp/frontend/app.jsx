import React, { useRef, useState } from "react";
import { checkConnection, createEvent, rsvpEvent, confirmAttendance, closeEvent, getEvent, listEvents, getRsvpCount } from "../lib.js/stellar.js";

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
        id: "event1",
        host: "",
        attendee: "",
        title: "Developer Meetup",
        venue: "Innovation Hub",
        capacity: "120",
        eventTime: String(nowTs() + 86400),
    });
    const [output, setOutput] = useState("Ready to manage event RSVPs.");
    const [status, setStatus] = useState("idle");
    const [walletKey, setWalletKey] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState("");
    const [activeTab, setActiveTab] = useState("event");
    const [rsvpCount, setRsvpCount] = useState("-");
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
            host: prev.host || user.publicKey,
            attendee: prev.attendee || user.publicKey,
        }));
        return `Wallet: ${user.publicKey}`;
    });

    const onCreateEvent = () => runAction("create", () => createEvent({
        id: form.id.trim(),
        host: form.host.trim(),
        title: form.title.trim(),
        venue: form.venue.trim(),
        capacity: form.capacity.trim(),
        eventTime: form.eventTime.trim(),
    }));

    const onRsvp = () => runAction("rsvp", () => rsvpEvent(form.id.trim(), form.attendee.trim()));
    const onConfirmAttendance = () => runAction("confirm", () => confirmAttendance(form.id.trim(), form.host.trim(), form.attendee.trim()));

    const onCloseEvent = () => {
        if (confirmClose) {
            clearTimeout(closeTimer.current);
            setConfirmClose(false);
            runAction("close", () => closeEvent(form.id.trim(), form.host.trim()));
            return;
        }

        setConfirmClose(true);
        closeTimer.current = setTimeout(() => setConfirmClose(false), 3000);
    };

    const onGetEvent = () => runAction("get", () => getEvent(form.id.trim()));
    const onListEvents = () => runAction("list", () => listEvents());
    const onGetCount = () => runAction("count", async () => {
        const value = await getRsvpCount(form.id.trim());
        setRsvpCount(String(value));
        return { rsvps: value };
    });

    const btnClass = (actionName, extra = "") => [extra, loadingAction === actionName ? "btn-loading" : ""].filter(Boolean).join(" ");
    const outputClass = status === "success" ? "output-success" : status === "error" ? "output-error" : "output-idle";
    const tabs = [
        { key: "event", label: "Event" },
        { key: "rsvp", label: "RSVP Flow" },
        { key: "lookup", label: "Lookup" },
    ];

    return (
        <main className="app">
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 42</p>
                <h1>Event RSVP</h1>
                <p className="subtitle">Launch an event, collect RSVPs, and confirm attendance directly on Stellar.</p>
                <div className="hero-stats">
                    <span className="stat-chip">RSVPs: {rsvpCount}</span>
                    <span className="stat-chip">Venue: {form.venue || "-"}</span>
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

            {activeTab === "event" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Create Event</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="id">Event ID</label>
                                <input id="id" name="id" value={form.id} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="host">Host Address</label>
                                <input id="host" name="host" value={form.host} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field">
                                <label htmlFor="title">Title</label>
                                <input id="title" name="title" value={form.title} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="venue">Venue</label>
                                <input id="venue" name="venue" value={form.venue} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="capacity">Capacity (u32)</label>
                                <input id="capacity" name="capacity" value={form.capacity} onChange={setField} type="number" />
                            </div>
                            <div className="field">
                                <label htmlFor="eventTime">Event Time (u64)</label>
                                <input id="eventTime" name="eventTime" value={form.eventTime} onChange={setField} type="number" />
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("create", "btn-primary")} onClick={onCreateEvent} disabled={isBusy}>
                                Create Event
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === "rsvp" && (
                <section className="card">
                    <div className="card-header">
                        <h2>RSVP Workflow</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="attendee">Attendee Address</label>
                                <input id="attendee" name="attendee" value={form.attendee} onChange={setField} placeholder="G..." />
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("rsvp", "btn-primary")} onClick={onRsvp} disabled={isBusy}>
                                RSVP Event
                            </button>
                            <button type="button" className={btnClass("confirm", "btn-ghost")} onClick={onConfirmAttendance} disabled={isBusy}>
                                Confirm Attendance
                            </button>
                            <button type="button" className={btnClass("close", "btn-warning")} onClick={onCloseEvent} disabled={isBusy}>
                                {confirmClose ? "Confirm Close?" : "Close Event"}
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
                            <button type="button" className={btnClass("get", "btn-ghost")} onClick={onGetEvent} disabled={isBusy}>
                                Get Event
                            </button>
                            <button type="button" className={btnClass("list", "btn-ghost")} onClick={onListEvents} disabled={isBusy}>
                                List Events
                            </button>
                            <button type="button" className={btnClass("count", "btn-ghost")} onClick={onGetCount} disabled={isBusy}>
                                Get RSVP Count
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
