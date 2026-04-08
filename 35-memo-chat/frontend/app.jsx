import React, { useState, useRef, useEffect } from "react";
import { checkConnection, createChannel, joinChannel, sendMemo, getMemo, getChannel, listChannels, getChannelMessageCount } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

export default function App() {
    const [form, setForm] = useState({
        id: "memo1",
        channelId: "general",
        creator: "",
        sender: "",
        member: "",
        channelName: "General Chat",
        description: "Public discussion channel",
        content: "Hello channel!",
        isPublic: true,
        timestamp: String(nowTs()),
    });
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [walletState, setWalletState] = useState("Wallet: not connected");
    const [walletConnected, setWalletConnected] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [activeTab, setActiveTab] = useState(0);

    const setField = (event) => {
        const { name, value, type, checked } = event.target;
        setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
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
                creator: prev.creator || addr,
                sender: prev.sender || addr,
                member: prev.member || addr,
            }));
            return `Wallet: ${addr}`;
        }
        setWalletState("Wallet: not connected");
        setWalletConnected(false);
        return "Wallet: not connected";
    });

    const onCreateChannel = () => runAction("createChannel", () => createChannel({
        id: form.channelId.trim(),
        creator: form.creator.trim(),
        channelName: form.channelName.trim(),
        description: form.description.trim(),
        isPublic: form.isPublic,
    }));

    const onJoinChannel = () => runAction("joinChannel", () => joinChannel(form.channelId.trim(), form.member.trim()));

    const onSendMemo = () => runAction("sendMemo", () => sendMemo({
        id: form.id.trim(),
        sender: form.sender.trim(),
        channel: form.channelId.trim(),
        content: form.content.trim(),
        timestamp: form.timestamp.trim(),
    }));

    const onGetMemo = () => runAction("getMemo", () => getMemo(form.id.trim()));

    const onGetChannel = () => runAction("getChannel", () => getChannel(form.channelId.trim()));

    const onListChannels = () => runAction("listChannels", () => listChannels());

    const onGetMsgCount = () => runAction("getMsgCount", () => getChannelMessageCount(form.channelId.trim()));

    const btnClass = (actionName, extra = "") => {
        const classes = [extra];
        if (loadingAction === actionName) classes.push("btn-loading");
        return classes.filter(Boolean).join(" ");
    };

    const truncAddr = walletConnected ? `${walletState.slice(0, 6)}...${walletState.slice(-4)}` : null;

    const tabs = ["Channels", "Messages", "Browse"];

    return (
        <main className="app">
            {/* ---- Hero ---- */}
            <section className="hero">
                <div className="hero-row">
                    <span className="hero-hash">#</span>
                    <div className="hero-title">
                        <span className="kicker">Stellar Soroban Project 35</span>
                        <h1>Memo Chat</h1>
                    </div>
                </div>
                <p className="subtitle">Create channels, join conversations, and send memos on-chain.</p>
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

            <div className="content-area">
                {activeTab === 0 && (
                    <>
                        {/* ---- Create Channel ---- */}
                        <section className="card">
                            <div className="card-header">
                                <span className="hash-badge">#</span>
                                <h2>Create Channel</h2>
                            </div>
                            <div className="card-body">
                                <div className="field-group">
                                    <div className="field">
                                        <label htmlFor="channelId">Channel ID</label>
                                        <input id="channelId" name="channelId" value={form.channelId} onChange={setField} />
                                        <span className="field-helper">Unique short identifier for this channel</span>
                                    </div>
                                    <div className="field">
                                        <label htmlFor="creator">Creator Address</label>
                                        <input id="creator" name="creator" value={form.creator} onChange={setField} placeholder="G..." />
                                        <span className="field-helper">Auto-filled from connected wallet</span>
                                    </div>
                                    <div className="field">
                                        <label htmlFor="channelName">Channel Name</label>
                                        <input id="channelName" name="channelName" value={form.channelName} onChange={setField} />
                                    </div>
                                    <div className="field">
                                        <label htmlFor="description">Description</label>
                                        <input id="description" name="description" value={form.description} onChange={setField} />
                                    </div>
                                </div>
                                <label className="checkbox-row">
                                    <input type="checkbox" name="isPublic" checked={form.isPublic} onChange={setField} />
                                    Public Channel
                                </label>
                                <div className="btn-row">
                                    <button type="button" className={btnClass("createChannel")} onClick={onCreateChannel} disabled={isBusy}>Create Channel</button>
                                </div>
                            </div>
                        </section>

                        {/* ---- Join Channel ---- */}
                        <section className="card">
                            <div className="card-header">
                                <span className="hash-badge">#</span>
                                <h2>Join Channel</h2>
                            </div>
                            <div className="card-body">
                                <div className="field-group">
                                    <div className="field">
                                        <label htmlFor="member">Member Address</label>
                                        <input id="member" name="member" value={form.member} onChange={setField} placeholder="G..." />
                                        <span className="field-helper">Auto-filled from connected wallet</span>
                                    </div>
                                </div>
                                <div className="btn-row">
                                    <button type="button" className={btnClass("joinChannel")} onClick={onJoinChannel} disabled={isBusy}>Join Channel</button>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {activeTab === 1 && (
                    <>
                        {/* ---- Send Message ---- */}
                        <section className="card">
                            <div className="card-header">
                                <span className="hash-badge">#</span>
                                <h2>Send Message</h2>
                            </div>
                            <div className="card-body">
                                <div className="field-group">
                                    <div className="field">
                                        <label htmlFor="memoId">Memo ID</label>
                                        <input id="memoId" name="id" value={form.id} onChange={setField} />
                                        <span className="field-helper">Unique identifier for this memo</span>
                                    </div>
                                    <div className="field">
                                        <label htmlFor="sender">Sender Address</label>
                                        <input id="sender" name="sender" value={form.sender} onChange={setField} placeholder="G..." />
                                        <span className="field-helper">Auto-filled from connected wallet</span>
                                    </div>
                                    <div className="field">
                                        <label htmlFor="timestamp">Timestamp (u64)</label>
                                        <input id="timestamp" name="timestamp" value={form.timestamp} onChange={setField} type="number" />
                                    </div>
                                    <div className="field full">
                                        <label htmlFor="content">Message Content</label>
                                        <textarea id="content" name="content" rows="3" value={form.content} onChange={setField} />
                                    </div>
                                </div>
                                <div className="btn-row">
                                    <button type="button" className={btnClass("sendMemo")} onClick={onSendMemo} disabled={isBusy}>Send Memo</button>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {activeTab === 2 && (
                    <>
                        {/* ---- Channel Browser ---- */}
                        <section className="card">
                            <div className="card-header">
                                <span className="hash-badge">#</span>
                                <h2>Channel Browser</h2>
                            </div>
                            <div className="card-body">
                                <div className="btn-row">
                                    <button type="button" className={`btn-ghost ${btnClass("getMemo")}`} onClick={onGetMemo} disabled={isBusy}>Get Memo</button>
                                    <button type="button" className={`btn-ghost ${btnClass("getChannel")}`} onClick={onGetChannel} disabled={isBusy}>Get Channel</button>
                                    <button type="button" className={`btn-ghost ${btnClass("listChannels")}`} onClick={onListChannels} disabled={isBusy}>List Channels</button>
                                    <button type="button" className={`btn-outline ${btnClass("getMsgCount")}`} onClick={onGetMsgCount} disabled={isBusy}>Message Count</button>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {/* ---- Output ---- */}
                <section className="output-panel">
                    <div className="output-header">
                        <span className="hash-badge">#</span>
                        <h2>Channel Feed</h2>
                    </div>
                    <div className={`output-body status-${status}`}>
                        <pre id="output">{output || <span className="empty-state">Connect your wallet and perform an action to see results here.</span>}</pre>
                    </div>
                </section>
            </div>
        </main>
    );
}
