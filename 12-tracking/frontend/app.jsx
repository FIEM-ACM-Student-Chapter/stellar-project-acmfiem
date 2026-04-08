import React, { useState, useRef } from "react";
import { checkConnection, createShipment, updateStatus, addCheckpoint, markDelivered, getShipment, listShipments, getShipmentCount } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const truncateAddress = (addr) => addr && addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-6)}` : addr;

const STATUS_LIST = ["created", "in_transit", "out_for_delivery", "delivered"];

export default function App() {
    const [form, setForm] = useState({
        id: "ship1",
        sender: "",
        receiverName: "John Doe",
        origin: "New York",
        destination: "Los Angeles",
        weight: "500",
        newStatus: "in_transit",
        location: "",
        notes: "",
        timestamp: String(nowTs()),
    });
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [walletState, setWalletState] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [countValue, setCountValue] = useState("-");
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
            setForm((prev) => ({ ...prev, sender: user.publicKey }));
            return `Connected: ${user.publicKey}`;
        }
        setWalletState(null);
        return "Wallet: not connected";
    });

    const onCreateShipment = () => runAction("createShipment", async () => createShipment({
        id: form.id.trim(),
        sender: form.sender.trim(),
        receiverName: form.receiverName.trim(),
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        weight: form.weight.trim(),
    }));

    const onUpdateStatus = () => runAction("updateStatus", async () => updateStatus({
        id: form.id.trim(),
        sender: form.sender.trim(),
        newStatus: form.newStatus.trim(),
        location: form.location.trim(),
        timestamp: form.timestamp.trim(),
    }));

    const onAddCheckpoint = () => runAction("addCheckpoint", async () => addCheckpoint({
        id: form.id.trim(),
        sender: form.sender.trim(),
        location: form.location.trim(),
        notes: form.notes.trim(),
        timestamp: form.timestamp.trim(),
    }));

    const handleMarkDelivered = () => {
        if (confirmAction === "markDelivered") {
            clearTimeout(confirmTimer.current);
            setConfirmAction(null);
            runAction("markDelivered", async () => markDelivered({
                id: form.id.trim(),
                sender: form.sender.trim(),
                timestamp: form.timestamp.trim(),
            }));
        } else {
            setConfirmAction("markDelivered");
            confirmTimer.current = setTimeout(() => setConfirmAction(null), 3000);
        }
    };

    const onGetShipment = () => runAction("getShipment", async () => getShipment(form.id.trim()));
    const onListShipments = () => runAction("listShipments", async () => listShipments());
    const onGetCount = () => runAction("getCount", async () => {
        const value = await getShipmentCount();
        setCountValue(String(value));
        return { count: value };
    });

    const activeIdx = STATUS_LIST.indexOf(form.newStatus);
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
                <span className="hero-icon">{"\u{1F69A}"}</span>
                <h1>Shipment Tracking System</h1>
                <div className="tracking-id">TRACK-{form.id.toUpperCase()}</div>
                <p className="subtitle">Create shipments, update status, add checkpoints, and track deliveries on-chain.</p>
                <span className="count-badge">Shipments: {countValue}</span>
            </section>

            <div className="container">
                <div className="two-col-grid">
                    {/* New Shipment Card */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-icon">{"\u{1F4E6}"}</span>
                            <h2>New Shipment</h2>
                        </div>

                        <div className="form-grid">
                            <div className="field">
                                <label htmlFor="shipmentId">Shipment ID</label>
                                <input id="shipmentId" name="id" value={form.id} onChange={setField} />
                                <span className="helper">Unique shipment identifier</span>
                            </div>
                            <div className="field">
                                <label htmlFor="sender">Sender Address</label>
                                <input id="sender" name="sender" value={form.sender} onChange={setField} placeholder="G..." />
                                <span className="helper">Auto-filled on wallet connect</span>
                            </div>
                            <div className="field">
                                <label htmlFor="receiverName">Receiver Name</label>
                                <input id="receiverName" name="receiverName" value={form.receiverName} onChange={setField} />
                                <span className="helper">Name of the package recipient</span>
                            </div>
                            <div className="field">
                                <label htmlFor="weight">Weight (u32)</label>
                                <input id="weight" name="weight" value={form.weight} onChange={setField} type="number" />
                                <span className="helper">Package weight in grams</span>
                            </div>
                            <div className="field">
                                <label htmlFor="origin">Origin</label>
                                <input id="origin" name="origin" value={form.origin} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="destination">Destination</label>
                                <input id="destination" name="destination" value={form.destination} onChange={setField} />
                            </div>
                        </div>

                        <div className="actions">
                            <button
                                type="button"
                                className={`btn-cyan ${loadingAction === "createShipment" ? "btn-loading" : ""}`}
                                onClick={onCreateShipment}
                                disabled={isBusy}
                            >
                                Create Shipment
                            </button>
                        </div>
                    </div>

                    {/* Update Tracking Panel */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-icon">{"\u{1F4CD}"}</span>
                            <h2>Update Tracking</h2>
                        </div>

                        {/* Visual progress indicator */}
                        <div className="status-track">
                            {STATUS_LIST.map((s, i) => (
                                <div key={s} className={`status-step${i <= activeIdx ? " active" : ""}`}>
                                    {s.replace(/_/g, " ")}
                                </div>
                            ))}
                        </div>

                        <div className="form-grid">
                            <div className="field">
                                <label htmlFor="newStatus">Status</label>
                                <select id="newStatus" name="newStatus" value={form.newStatus} onChange={setField}>
                                    {STATUS_LIST.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="field">
                                <label htmlFor="location">Current Location</label>
                                <input id="location" name="location" value={form.location} onChange={setField} />
                                <span className="helper">Current city/checkpoint</span>
                            </div>
                            <div className="field span-2">
                                <label htmlFor="notes">Checkpoint Notes</label>
                                <textarea id="notes" name="notes" rows="3" value={form.notes} onChange={setField} />
                                <span className="helper">Any notes about this checkpoint</span>
                            </div>
                            <div className="field">
                                <label htmlFor="timestamp">Timestamp (u64)</label>
                                <input id="timestamp" name="timestamp" value={form.timestamp} onChange={setField} type="number" />
                                <span className="helper">Unix timestamp for the update</span>
                            </div>
                        </div>

                        <div className="actions">
                            <button
                                type="button"
                                className={`btn-cyan ${loadingAction === "updateStatus" ? "btn-loading" : ""}`}
                                onClick={onUpdateStatus}
                                disabled={isBusy}
                            >
                                Update Status
                            </button>
                            <button
                                type="button"
                                className={`btn-dark ${loadingAction === "addCheckpoint" ? "btn-loading" : ""}`}
                                onClick={onAddCheckpoint}
                                disabled={isBusy}
                            >
                                Add Checkpoint
                            </button>
                        </div>
                    </div>
                </div>

                {/* Delivery Actions */}
                <div className="card">
                    <div className="card-header">
                        <span className="card-icon">{"\u2705"}</span>
                        <h2>Delivery Actions</h2>
                    </div>
                    <div className="actions">
                        <button
                            type="button"
                            className={`btn-success ${loadingAction === "markDelivered" ? "btn-loading" : ""} ${confirmAction === "markDelivered" ? "btn-confirm" : ""}`}
                            onClick={handleMarkDelivered}
                            disabled={isBusy}
                        >
                            {confirmAction === "markDelivered" ? "Confirm Delivery?" : "Mark Delivered"}
                        </button>
                    </div>
                    <div className="query-actions">
                        <button
                            type="button"
                            className={`btn-ghost ${loadingAction === "getShipment" ? "btn-loading" : ""}`}
                            onClick={onGetShipment}
                            disabled={isBusy}
                        >
                            Get Shipment
                        </button>
                        <button
                            type="button"
                            className={`btn-ghost ${loadingAction === "listShipments" ? "btn-loading" : ""}`}
                            onClick={onListShipments}
                            disabled={isBusy}
                        >
                            List Shipments
                        </button>
                        <button
                            type="button"
                            className={`btn-ghost ${loadingAction === "getCount" ? "btn-loading" : ""}`}
                            onClick={onGetCount}
                            disabled={isBusy}
                        >
                            Get Count
                        </button>
                    </div>
                </div>

                {/* Shipment Log */}
                <section className="log-section">
                    <h2>{"\u{1F4DD}"} Shipment Log</h2>
                    <pre id="output" className={statusClass}>
                        {output || "Connect your wallet and perform an action to see results here."}
                    </pre>
                </section>
            </div>
        </main>
    );
}
