import React, { useState, useRef, useEffect } from "react";
import { checkConnection, setRate, sendMessage, readMessage, getMessage, listInbox, getRate, getEarnings } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

export default function App() {
    const [form, setForm] = useState({
        id: "msg1",
        sender: "",
        recipient: "",
        content: "Hello there!",
        paymentAmount: "100",
        rate: "50",
    });
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [walletState, setWalletState] = useState("Wallet: not connected");
    const [walletConnected, setWalletConnected] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [activeTab, setActiveTab] = useState(0);

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
            setForm((prev) => ({ ...prev, sender: addr, recipient: prev.recipient || addr }));
            return `Wallet: ${addr}`;
        }
        setWalletState("Wallet: not connected");
        setWalletConnected(false);
        return "Wallet: not connected";
    });

    const onSetRate = () => runAction("setRate", () => setRate(form.recipient.trim(), form.rate.trim()));

    const onSendMessage = () => runAction("sendMessage", () => sendMessage({
        id: form.id.trim(),
        sender: form.sender.trim(),
        recipient: form.recipient.trim(),
        content: form.content.trim(),
        paymentAmount: form.paymentAmount.trim(),
    }));

    const onReadMessage = () => runAction("readMessage", () => readMessage(form.id.trim(), form.recipient.trim()));

    const onGetMessage = () => runAction("getMessage", () => getMessage(form.id.trim()));

    const onListInbox = () => runAction("listInbox", () => listInbox(form.recipient.trim()));

    const onGetRate = () => runAction("getRate", () => getRate(form.recipient.trim()));

    const onGetEarnings = () => runAction("getEarnings", () => getEarnings(form.recipient.trim()));

    const btnClass = (actionName, extra = "") => {
        const classes = [extra];
        if (loadingAction === actionName) classes.push("btn-loading");
        return classes.filter(Boolean).join(" ");
    };

    const truncAddr = walletConnected ? `${walletState.slice(0, 6)}...${walletState.slice(-4)}` : null;

    const tabs = ["Set Rate", "Send Message", "Inbox"];

    return (
        <main className="app">
            {/* ---- Hero ---- */}
            <section className="hero">
                <div className="hero-row">
                    <span className="hero-icon">&#128172;</span>
                    <div className="hero-title-block">
                        <h1>Pay-to-Message</h1>
                        <span style={{ fontSize: "0.82rem" }}>
                            <span className="online-dot"></span>Stellar Soroban Project 34
                        </span>
                    </div>
                </div>
                <p className="subtitle">Send paid messages to recipients who set their own message rate.</p>
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
                    <>
                        {/* ---- Set Message Rate ---- */}
                        <section className="card full-width">
                            <div className="card-header">
                                <span className="icon">&#9881;</span>
                                <h2>Set Message Rate</h2>
                            </div>
                            <div className="card-body">
                                <div className="field-group">
                                    <div className="field">
                                        <label htmlFor="recipient">Recipient Address</label>
                                        <input id="recipient" name="recipient" value={form.recipient} onChange={setField} placeholder="G..." />
                                        <span className="field-helper">The wallet address that will receive paid messages</span>
                                    </div>
                                    <div className="field">
                                        <label htmlFor="rate">Rate Per Message (i128)</label>
                                        <input id="rate" name="rate" value={form.rate} onChange={setField} type="number" />
                                        <span className="field-helper">Minimum payment required to send you a message</span>
                                    </div>
                                </div>
                                <div className="btn-row">
                                    <button type="button" className={btnClass("setRate")} onClick={onSetRate} disabled={isBusy}>Set Rate</button>
                                    <button type="button" className={`btn-ghost ${btnClass("getRate")}`} onClick={onGetRate} disabled={isBusy}>Get Rate</button>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {activeTab === 1 && (
                    <>
                        {/* ---- Send Message (Composer) ---- */}
                        <section className="card full-width">
                            <div className="card-header">
                                <span className="icon">&#9993;</span>
                                <h2>Send Message</h2>
                            </div>
                            <div className="card-body">
                                <div className="field-group">
                                    <div className="field">
                                        <label htmlFor="msgId">Message ID</label>
                                        <input id="msgId" name="id" value={form.id} onChange={setField} />
                                        <span className="field-helper">Unique identifier for this message</span>
                                    </div>
                                    <div className="field">
                                        <label htmlFor="paymentAmount">Payment Amount (i128)</label>
                                        <input id="paymentAmount" name="paymentAmount" value={form.paymentAmount} onChange={setField} type="number" />
                                        <span className="field-helper">Must meet or exceed the recipient's rate</span>
                                    </div>
                                    <div className="field">
                                        <label htmlFor="sender">Sender Address</label>
                                        <input id="sender" name="sender" value={form.sender} onChange={setField} placeholder="G..." />
                                        <span className="field-helper">Auto-filled from connected wallet</span>
                                    </div>
                                </div>
                                <div className="composer">
                                    <textarea id="content" name="content" rows="2" value={form.content} onChange={setField} placeholder="Type a message..." />
                                    <button type="button" className={btnClass("sendMessage")} onClick={onSendMessage} disabled={isBusy} title="Send">&#10148;</button>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {activeTab === 2 && (
                    <>
                        {/* ---- Inbox & Earnings ---- */}
                        <section className="card full-width">
                            <div className="card-header">
                                <span className="icon">&#128229;</span>
                                <h2>Inbox &amp; Earnings</h2>
                            </div>
                            <div className="card-body">
                                <div className="btn-row">
                                    <button type="button" className={btnClass("readMessage")} onClick={onReadMessage} disabled={isBusy}>Mark Read</button>
                                    <button type="button" className={`btn-secondary ${btnClass("getMessage")}`} onClick={onGetMessage} disabled={isBusy}>Get Message</button>
                                    <button type="button" className={`btn-secondary ${btnClass("listInbox")}`} onClick={onListInbox} disabled={isBusy}>List Inbox</button>
                                    <button type="button" className={`btn-ghost ${btnClass("getEarnings")}`} onClick={onGetEarnings} disabled={isBusy}>Get Earnings</button>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {/* ---- Message Feed (Output) ---- */}
                <section className="output-panel full-width">
                    <div className="output-header">
                        <span className="icon">&#128488;</span>
                        <h2>Message Feed</h2>
                    </div>
                    <div className="chat-output">
                        <div className={`chat-bubble status-${status}`}>
                            <pre id="output">{output || <span className="empty-state">Connect your wallet and perform an action to see results here.</span>}</pre>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
