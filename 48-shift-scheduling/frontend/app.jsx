import React, { useState } from "react";
import { checkConnection, createShift, assignShift, startShift, completeShift, getShift, listShifts, getActiveShiftCount } from "../lib.js/stellar.js";

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
        id: "shift1",
        manager: "",
        worker: "",
        title: "Evening Support Desk",
        location: "Main Lobby",
        startTime: String(nowTs() + 3600),
        endTime: String(nowTs() + 14400),
    });
    const [output, setOutput] = useState("Ready to schedule shifts.");
    const [status, setStatus] = useState("idle");
    const [walletKey, setWalletKey] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState("");
    const [activeTab, setActiveTab] = useState("shift");
    const [activeCount, setActiveCount] = useState("-");

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
            manager: prev.manager || user.publicKey,
            worker: prev.worker || user.publicKey,
        }));
        return `Wallet: ${user.publicKey}`;
    });

    const onCreateShift = () => runAction("create", () => createShift({
        id: form.id.trim(),
        manager: form.manager.trim(),
        title: form.title.trim(),
        location: form.location.trim(),
        startTime: form.startTime.trim(),
        endTime: form.endTime.trim(),
    }));

    const onAssignShift = () => runAction("assign", () => assignShift({
        id: form.id.trim(),
        manager: form.manager.trim(),
        worker: form.worker.trim(),
    }));

    const onStartShift = () => runAction("start", () => startShift(form.id.trim(), form.worker.trim()));
    const onCompleteShift = () => runAction("complete", () => completeShift(form.id.trim(), form.worker.trim()));
    const onGetShift = () => runAction("get", () => getShift(form.id.trim()));
    const onListShifts = () => runAction("list", () => listShifts());
    const onGetActiveCount = () => runAction("count", async () => {
        const value = await getActiveShiftCount();
        setActiveCount(String(value));
        return { activeShifts: value };
    });

    const btnClass = (actionName, extra = "") => [extra, loadingAction === actionName ? "btn-loading" : ""].filter(Boolean).join(" ");
    const outputClass = status === "success" ? "output-success" : status === "error" ? "output-error" : "output-idle";
    const tabs = [
        { key: "shift", label: "Shift" },
        { key: "workflow", label: "Workflow" },
        { key: "lookup", label: "Lookup" },
    ];

    return (
        <main className="app">
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 48</p>
                <h1>Shift Scheduling</h1>
                <p className="subtitle">Create shifts, assign workers, and track active versus completed schedules on-chain.</p>
                <div className="hero-stats">
                    <span className="stat-chip">Active Shifts: {activeCount}</span>
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

            {activeTab === "shift" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Create Shift</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="id">Shift ID</label>
                                <input id="id" name="id" value={form.id} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="manager">Manager Address</label>
                                <input id="manager" name="manager" value={form.manager} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field">
                                <label htmlFor="worker">Worker Address</label>
                                <input id="worker" name="worker" value={form.worker} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field">
                                <label htmlFor="location">Location</label>
                                <input id="location" name="location" value={form.location} onChange={setField} />
                            </div>
                            <div className="field full">
                                <label htmlFor="title">Shift Title</label>
                                <input id="title" name="title" value={form.title} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="startTime">Start Time (u64)</label>
                                <input id="startTime" name="startTime" value={form.startTime} onChange={setField} type="number" />
                            </div>
                            <div className="field">
                                <label htmlFor="endTime">End Time (u64)</label>
                                <input id="endTime" name="endTime" value={form.endTime} onChange={setField} type="number" />
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("create", "btn-primary")} onClick={onCreateShift} disabled={isBusy}>
                                Create Shift
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
                            <button type="button" className={btnClass("assign", "btn-primary")} onClick={onAssignShift} disabled={isBusy}>
                                Assign Worker
                            </button>
                            <button type="button" className={btnClass("start", "btn-ghost")} onClick={onStartShift} disabled={isBusy}>
                                Start Shift
                            </button>
                            <button type="button" className={btnClass("complete", "btn-warning")} onClick={onCompleteShift} disabled={isBusy}>
                                Complete Shift
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
                            <button type="button" className={btnClass("get", "btn-ghost")} onClick={onGetShift} disabled={isBusy}>
                                Get Shift
                            </button>
                            <button type="button" className={btnClass("list", "btn-ghost")} onClick={onListShifts} disabled={isBusy}>
                                List Shifts
                            </button>
                            <button type="button" className={btnClass("count", "btn-ghost")} onClick={onGetActiveCount} disabled={isBusy}>
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
