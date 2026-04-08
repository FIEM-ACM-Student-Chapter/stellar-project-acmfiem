import React, { useState, useRef, useEffect } from "react";
import { checkConnection, createOrder, payOrder, confirmOrder, shipOrder, deliverOrder, disputeOrder, getOrder, listOrders } from "../lib.js/stellar.js";

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

export default function App() {
    const [form, setForm] = useState({
        id: "order1",
        seller: "",
        buyer: "",
        description: "Custom widget order",
        itemsCount: "3",
        totalAmount: "1500",
        paymentAmount: "1500",
        trackingInfo: "TRACK-12345",
        disputeReason: "",
    });
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [walletState, setWalletState] = useState("Wallet: not connected");
    const [walletConnected, setWalletConnected] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [activeTab, setActiveTab] = useState(0);
    const [confirmDispute, setConfirmDispute] = useState(false);
    const disputeTimer = useRef(null);

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
                seller: prev.seller || addr,
                buyer: prev.buyer || addr,
            }));
            return `Wallet: ${addr}`;
        }
        setWalletState("Wallet: not connected");
        setWalletConnected(false);
        return "Wallet: not connected";
    });

    const onCreateOrder = () => runAction("createOrder", () => createOrder({
        id: form.id.trim(),
        seller: form.seller.trim(),
        buyer: form.buyer.trim(),
        description: form.description.trim(),
        itemsCount: form.itemsCount.trim(),
        totalAmount: form.totalAmount.trim(),
    }));

    const onPayOrder = () => runAction("payOrder", () => payOrder(form.id.trim(), form.buyer.trim(), form.paymentAmount.trim()));

    const onConfirmOrder = () => runAction("confirmOrder", () => confirmOrder(form.id.trim(), form.seller.trim()));

    const onShipOrder = () => runAction("shipOrder", () => shipOrder(form.id.trim(), form.seller.trim(), form.trackingInfo.trim()));

    const onDeliverOrder = () => runAction("deliverOrder", () => deliverOrder(form.id.trim(), form.seller.trim()));

    const onDisputeOrder = () => {
        if (!confirmDispute) {
            setConfirmDispute(true);
            disputeTimer.current = setTimeout(() => setConfirmDispute(false), 3000);
            return;
        }
        clearTimeout(disputeTimer.current);
        setConfirmDispute(false);
        runAction("disputeOrder", () => disputeOrder(form.id.trim(), form.buyer.trim(), form.disputeReason.trim()));
    };

    const onGetOrder = () => runAction("getOrder", () => getOrder(form.id.trim()));

    const onListOrders = () => runAction("listOrders", () => listOrders());

    const pipelineSteps = ["Created", "Paid", "Confirmed", "Shipped", "Delivered"];

    const btnClass = (actionName, extra = "") => {
        const classes = [extra];
        if (loadingAction === actionName) classes.push("btn-loading");
        return classes.filter(Boolean).join(" ");
    };

    const truncAddr = walletConnected ? `${walletState.slice(0, 6)}...${walletState.slice(-4)}` : null;

    const tabs = ["Create Order", "Payment & Shipping", "Disputes"];

    return (
        <main className="app">
            {/* ---- Hero ---- */}
            <section className="hero">
                <div className="hero-row">
                    <span className="hero-cart">&#128722;</span>
                    <div className="hero-title">
                        <span className="kicker">Stellar Soroban Project 38</span>
                        <h1>Prepaid Orders</h1>
                    </div>
                </div>
                <p className="subtitle">Create orders, prepay, confirm, ship, deliver, or dispute.</p>
                <div className="pipeline">
                    {pipelineSteps.map((step, i) => (
                        <React.Fragment key={step}>
                            <div className="pipeline-step">
                                <span className="dot">{i + 1}</span>
                                <span className="label">{step}</span>
                            </div>
                            {i < pipelineSteps.length - 1 && <span className="pipeline-arrow">&#8594;</span>}
                        </React.Fragment>
                    ))}
                </div>
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
                        <div className="card-header orange-header">
                            <span className="icon">&#128230;</span>
                            <h2>Create Order</h2>
                        </div>
                        <div className="card-body">
                            <div className="field-group">
                                <div className="field">
                                    <label htmlFor="orderId">Order ID</label>
                                    <input id="orderId" name="id" value={form.id} onChange={setField} />
                                    <span className="field-helper">Unique identifier for this order</span>
                                </div>
                                <div className="field">
                                    <label htmlFor="seller">Seller Address</label>
                                    <input id="seller" name="seller" value={form.seller} onChange={setField} placeholder="G..." />
                                    <span className="field-helper">Auto-filled from connected wallet</span>
                                </div>
                                <div className="field">
                                    <label htmlFor="buyer">Buyer Address</label>
                                    <input id="buyer" name="buyer" value={form.buyer} onChange={setField} placeholder="G..." />
                                </div>
                            </div>
                            <div className="field-row-3">
                                <div className="field">
                                    <label htmlFor="itemsCount">Items Count</label>
                                    <input id="itemsCount" name="itemsCount" value={form.itemsCount} onChange={setField} type="number" />
                                </div>
                                <div className="field">
                                    <label htmlFor="totalAmount">Total Amount (i128)</label>
                                    <input id="totalAmount" name="totalAmount" value={form.totalAmount} onChange={setField} type="number" />
                                    <span className="field-helper">Order total in base units</span>
                                </div>
                                <div className="field">
                                    <label htmlFor="paymentAmount">Payment Amount (i128)</label>
                                    <input id="paymentAmount" name="paymentAmount" value={form.paymentAmount} onChange={setField} type="number" />
                                </div>
                            </div>
                            <div className="field full">
                                <label htmlFor="description">Description</label>
                                <textarea id="description" name="description" rows="2" value={form.description} onChange={setField} />
                            </div>
                            <div className="btn-row">
                                <button type="button" className={btnClass("createOrder")} onClick={onCreateOrder} disabled={isBusy}>Create Order</button>
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 1 && (
                    <>
                        {/* ---- Payment ---- */}
                        <section className="card">
                            <div className="card-header neutral-header">
                                <span className="icon">&#128179;</span>
                                <h2>Payment</h2>
                            </div>
                            <div className="card-body">
                                <div className="btn-row">
                                    <button type="button" className={btnClass("payOrder")} onClick={onPayOrder} disabled={isBusy}>Pay Order</button>
                                    <button type="button" className={`btn-success ${btnClass("confirmOrder")}`} onClick={onConfirmOrder} disabled={isBusy}>Confirm Payment</button>
                                </div>
                            </div>
                        </section>

                        {/* ---- Shipping & Delivery ---- */}
                        <section className="card">
                            <div className="card-header neutral-header">
                                <span className="icon">&#128666;</span>
                                <h2>Shipping &amp; Delivery</h2>
                            </div>
                            <div className="card-body">
                                <div className="field-group">
                                    <div className="field full">
                                        <label htmlFor="trackingInfo">Tracking Info</label>
                                        <input id="trackingInfo" name="trackingInfo" value={form.trackingInfo} onChange={setField} />
                                        <span className="field-helper">Carrier tracking number or shipping reference</span>
                                    </div>
                                </div>
                                <div className="btn-row">
                                    <button type="button" className={`btn-dark ${btnClass("shipOrder")}`} onClick={onShipOrder} disabled={isBusy}>Ship Order</button>
                                    <button type="button" className={`btn-success ${btnClass("deliverOrder")}`} onClick={onDeliverOrder} disabled={isBusy}>Mark Delivered</button>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {activeTab === 2 && (
                    <>
                        {/* ---- Disputes ---- */}
                        <section className="card full-width">
                            <div className="card-header danger-header">
                                <span className="icon">&#9888;</span>
                                <h2>Disputes</h2>
                            </div>
                            <div className="card-body">
                                <div className="field">
                                    <label htmlFor="disputeReason">Dispute Reason</label>
                                    <textarea id="disputeReason" name="disputeReason" rows="2" value={form.disputeReason} onChange={setField} placeholder="Describe the issue..." />
                                    <span className="field-helper">Provide a clear description of the dispute</span>
                                </div>
                                <div className="btn-row">
                                    <button type="button" className={`btn-danger ${btnClass("disputeOrder")}`} onClick={onDisputeOrder} disabled={isBusy}>
                                        {confirmDispute ? "Confirm?" : "File Dispute"}
                                    </button>
                                    <button type="button" className={`btn-ghost ${btnClass("getOrder")}`} onClick={onGetOrder} disabled={isBusy}>Get Order</button>
                                    <button type="button" className={`btn-ghost ${btnClass("listOrders")}`} onClick={onListOrders} disabled={isBusy}>List Orders</button>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {/* ---- Order Log (Output) ---- */}
                <section className="output-panel full-width">
                    <div className="output-header">
                        <span>&#128203;</span>
                        <h2>Order Log</h2>
                    </div>
                    <div className={`output-body status-${status}`}>
                        <pre id="output">{output || <span className="empty-state">Connect your wallet and perform an action to see results here.</span>}</pre>
                    </div>
                </section>
            </div>
        </main>
    );
}
