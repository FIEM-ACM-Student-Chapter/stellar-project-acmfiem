import React, { useState, useRef, useCallback } from "react";
import { checkConnection, registerResource, reserveResource, releaseResource, checkAvailability, getResource, listResources, getCount } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const initialForm = () => ({
    id: "res1",
    owner: "",
    name: "Conference Room A",
    resourceType: "room",
    capacity: "10",
    location: "Building 1, Floor 2",
    reserver: "",
    startTime: String(nowTs()),
    endTime: String(nowTs() + 3600),
});

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const truncateAddress = (addr) => {
    if (!addr || addr.length < 12) return addr;
    return addr.slice(0, 8) + "..." + addr.slice(-4);
};

export default function App() {
    const [form, setForm] = useState(initialForm);
    const [output, setOutput] = useState("Ready.");
    const [walletState, setWalletState] = useState("Wallet: not connected");
    const [walletKey, setWalletKey] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [busyAction, setBusyAction] = useState("");
    const [countValue, setCountValue] = useState("-");
    const [status, setStatus] = useState("idle");
    const [confirmAction, setConfirmAction] = useState(null);
    const confirmTimer = useRef(null);

    const setField = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const runAction = async (action, actionName) => {
        setIsBusy(true);
        setBusyAction(actionName || "");
        try {
            const result = await action();
            setOutput(toOutput(result ?? "No data found"));
            setStatus("success");
        } catch (error) {
            setOutput(error?.message || String(error));
            setStatus("error");
        } finally {
            setIsBusy(false);
            setBusyAction("");
        }
    };

    const onConnect = () => runAction(async () => {
        const user = await checkConnection();
        const next = user ? `Wallet: ${user.publicKey}` : "Wallet: not connected";
        setWalletState(next);
        if (user) {
            setWalletKey(user.publicKey);
            setForm(prev => ({ ...prev, owner: user.publicKey, reserver: user.publicKey }));
        }
        return next;
    }, "connect");

    const onRegister = () => runAction(async () => registerResource({
        id: form.id.trim(),
        owner: form.owner.trim(),
        name: form.name.trim(),
        resourceType: form.resourceType.trim(),
        capacity: form.capacity.trim(),
        location: form.location.trim(),
    }), "register");

    const onReserve = () => runAction(async () => reserveResource({
        id: form.id.trim(),
        reserver: form.reserver.trim() || form.owner.trim(),
        startTime: Number(form.startTime || nowTs()),
        endTime: Number(form.endTime || nowTs() + 3600),
    }), "reserve");

    const handleRelease = useCallback(() => {
        if (confirmAction === "release") {
            clearTimeout(confirmTimer.current);
            setConfirmAction(null);
            runAction(async () => releaseResource({
                id: form.id.trim(),
                reserver: form.reserver.trim() || form.owner.trim(),
            }), "release");
        } else {
            setConfirmAction("release");
            confirmTimer.current = setTimeout(() => setConfirmAction(null), 3000);
        }
    }, [confirmAction, form.id, form.reserver, form.owner]);

    const onCheckAvailability = () => runAction(async () => {
        const available = await checkAvailability(form.id.trim());
        return { resourceId: form.id.trim(), available };
    }, "check");

    const onGetResource = () => runAction(async () => getResource(form.id.trim()), "getResource");

    const onList = () => runAction(async () => listResources(), "list");

    const onCount = () => runAction(async () => {
        const value = await getCount();
        setCountValue(String(value));
        return { count: value };
    }, "count");

    const isConnected = walletKey.length > 0;

    const btnLoadingText = (actionName, label) => {
        if (isBusy && busyAction === actionName) return "Processing...";
        return label;
    };

    const btnCls = (actionName, base) => {
        let cls = base;
        if (isBusy && busyAction === actionName) cls += " btn-loading";
        return cls;
    };

    const outputClass = () => {
        if (status === "success") return "output-success";
        if (status === "error") return "output-error";
        return "output-idle";
    };

    return (
        <main className="app">
            {/* ── Sidebar ── */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <p className="kicker">Stellar Soroban Project 2</p>
                    <h1>Resource Availability</h1>
                    <p className="subtitle">
                        Register resources, make reservations with time slots, check availability, and release reservations.
                    </p>
                </div>

                {/* Wallet */}
                <div className="wallet-section">
                    <button type="button" className={btnCls("connect", "connect-btn")} id="connectWallet" onClick={onConnect} disabled={isBusy}>
                        {btnLoadingText("connect", "Connect Freighter")}
                    </button>
                    <div className="wallet-address-row">
                        <span className={`status-dot ${isConnected ? "connected" : "disconnected"}`}></span>
                        <p className="wallet-address" id="walletState">
                            {isConnected ? `${truncateAddress(walletKey)} - Connected` : "Not Connected"}
                        </p>
                    </div>
                </div>

                {/* Metrics */}
                <div className="metric-cards">
                    <div className="metric-card">
                        <div className="metric-label">Registered Resources</div>
                        <div className="metric-value">{countValue}</div>
                    </div>
                </div>

                {/* Resource Registration Form */}
                <div className="sidebar-form">
                    <h2>Register Resource</h2>

                    <div className="sidebar-field">
                        <label htmlFor="entryId">Resource ID</label>
                        <input id="entryId" name="id" value={form.id} onChange={setField} />
                        <span className="helper">Unique identifier, max 32 characters</span>
                    </div>
                    <div className="sidebar-field">
                        <label htmlFor="owner">Owner Address</label>
                        <input id="owner" name="owner" value={form.owner} onChange={setField} placeholder="G..." />
                        <span className="helper">Stellar public key starting with G...</span>
                    </div>
                    <div className="sidebar-field">
                        <label htmlFor="name">Resource Name</label>
                        <input id="name" name="name" value={form.name} onChange={setField} />
                    </div>
                    <div className="sidebar-field">
                        <label htmlFor="resourceType">Type</label>
                        <input id="resourceType" name="resourceType" value={form.resourceType} onChange={setField} placeholder="room, vehicle, equipment..." />
                    </div>
                    <div className="sidebar-field">
                        <label htmlFor="capacity">Capacity</label>
                        <input id="capacity" name="capacity" value={form.capacity} onChange={setField} type="number" />
                    </div>
                    <div className="sidebar-field">
                        <label htmlFor="location">Location</label>
                        <input id="location" name="location" value={form.location} onChange={setField} />
                    </div>

                    <div className="sidebar-actions">
                        <button type="button" className={btnCls("register", "btn-sidebar btn-register")} onClick={onRegister} disabled={isBusy}>
                            {btnLoadingText("register", "Register Resource")}
                        </button>
                        <button type="button" className={btnCls("getResource", "btn-sidebar")} onClick={onGetResource} disabled={isBusy}>
                            {btnLoadingText("getResource", "Get Resource")}
                        </button>
                        <button type="button" className={btnCls("list", "btn-sidebar")} onClick={onList} disabled={isBusy}>
                            {btnLoadingText("list", "List All")}
                        </button>
                        <button type="button" className={btnCls("count", "btn-sidebar")} onClick={onCount} disabled={isBusy}>
                            {btnLoadingText("count", "Get Count")}
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <div className="main-content">
                {/* Reservation Card */}
                <div className="panel">
                    <div className="panel-header reservation-header">
                        <h2>Reservation Management</h2>
                        <span className="availability-badge badge-available">Available</span>
                    </div>
                    <div className="panel-body">
                        <div className="reservation-fields">
                            <div className="res-field">
                                <label htmlFor="reserver">Reserver Address</label>
                                <input id="reserver" name="reserver" value={form.reserver} onChange={setField} placeholder="G... (defaults to owner)" />
                                <span className="helper">Stellar public key starting with G...</span>
                            </div>
                            <div className="time-row">
                                <div className="res-field">
                                    <label htmlFor="startTime">Start Time (u64 timestamp)</label>
                                    <input id="startTime" name="startTime" value={form.startTime} onChange={setField} type="number" />
                                    <span className="helper">Unix timestamp in seconds</span>
                                </div>
                                <div className="res-field">
                                    <label htmlFor="endTime">End Time (u64 timestamp)</label>
                                    <input id="endTime" name="endTime" value={form.endTime} onChange={setField} type="number" />
                                    <span className="helper">Unix timestamp in seconds</span>
                                </div>
                            </div>
                        </div>
                        <div className="reservation-actions">
                            <button type="button" className={btnCls("reserve", "btn-main btn-reserve")} onClick={onReserve} disabled={isBusy}>
                                {btnLoadingText("reserve", "Reserve Resource")}
                            </button>
                            <button
                                type="button"
                                className={`${btnCls("release", "btn-main btn-release")} ${confirmAction === "release" ? "btn-confirm" : ""}`}
                                onClick={handleRelease}
                                disabled={isBusy}
                            >
                                {confirmAction === "release" ? "Confirm Release?" : btnLoadingText("release", "Release Resource")}
                            </button>
                            <button type="button" className={btnCls("check", "btn-main btn-check")} onClick={onCheckAvailability} disabled={isBusy}>
                                {btnLoadingText("check", "Check Availability")}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Status / Output Panel */}
                <div className="panel">
                    <div className="panel-header status-header">
                        <h2>Status Panel</h2>
                    </div>
                    <div className="panel-body" style={{ padding: 0 }}>
                        <div className={`status-output ${outputClass()}`}>
                            <div className="status-bar">
                                <span className="status-dot-live"></span>
                                Live Output
                            </div>
                            {output === "Ready." ? (
                                <div className="empty-state">
                                    <div className="empty-icon">&#9678;</div>
                                    <p>Connect your wallet and perform an action to see results here.</p>
                                </div>
                            ) : (
                                <pre id="output">{output}</pre>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
