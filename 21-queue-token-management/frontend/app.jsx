import React, { useState, useRef } from "react";
import { checkConnection, createQueue, takeToken, callNext, skipToken, getQueue, listQueues, getCurrentWait } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

export default function App() {
    const [form, setForm] = useState({
        id: "queue1",
        admin: "",
        queueName: "Main Queue",
        maxCapacity: "50",
        customer: "",
        tokenNumber: "1",
    });
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [walletState, setWalletState] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [waitCount, setWaitCount] = useState("-");
    const [activeTab, setActiveTab] = useState("create");
    const confirmTimers = useRef({});
    const [confirmingBtn, setConfirmingBtn] = useState(null);

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
            setForm((prev) => ({ ...prev, admin: user.publicKey, customer: prev.customer || user.publicKey }));
            return `Connected: ${user.publicKey}`;
        }
        setWalletState(null);
        return "Wallet: not connected";
    });

    const onCreateQueue = () => runAction("createQueue", async () =>
        createQueue({
            id: form.id.trim(),
            admin: form.admin.trim(),
            queueName: form.queueName.trim(),
            maxCapacity: form.maxCapacity.trim(),
        })
    );

    const onTakeToken = () => runAction("takeToken", async () =>
        takeToken({
            queueId: form.id.trim(),
            customer: form.customer.trim(),
        })
    );

    const onCallNext = () => runAction("callNext", async () =>
        callNext({
            queueId: form.id.trim(),
            admin: form.admin.trim(),
        })
    );

    const handleDestructive = (btnKey, action) => {
        if (confirmingBtn === btnKey) {
            clearTimeout(confirmTimers.current[btnKey]);
            setConfirmingBtn(null);
            action();
        } else {
            setConfirmingBtn(btnKey);
            confirmTimers.current[btnKey] = setTimeout(() => setConfirmingBtn(null), 3000);
        }
    };

    const onSkipToken = () => handleDestructive("skip", () =>
        runAction("skipToken", async () =>
            skipToken({
                queueId: form.id.trim(),
                admin: form.admin.trim(),
                tokenNumber: form.tokenNumber.trim(),
            })
        )
    );

    const onGetQueue = () => runAction("getQueue", async () => getQueue(form.id.trim()));

    const onListQueues = () => runAction("listQueues", async () => listQueues());

    const onGetWait = () => runAction("getWait", async () => {
        const value = await getCurrentWait(form.id.trim());
        setWaitCount(String(value));
        return { waiting: value };
    });

    const truncAddr = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
    const tabs = [
        { key: "create", label: "Create Queue" },
        { key: "operations", label: "Operations" },
        { key: "status", label: "Status" },
    ];

    return (
        <main className="app">
            {/* Wallet Status Bar */}
            <div className="wallet-status-bar">
                <div className="wallet-status-left">
                    <span className={`wallet-dot ${walletState ? "connected" : ""}`} />
                    <span className="wallet-addr">
                        {walletState ? truncAddr(walletState) : "Not connected"}
                    </span>
                </div>
                <button
                    type="button"
                    id="connectWallet"
                    onClick={onConnect}
                    disabled={isBusy}
                    className={loadingAction === "connect" ? "btn-loading" : ""}
                >
                    {walletState ? "Reconnect" : "Connect Freighter"}
                </button>
            </div>

            {/* Hero: NOW SERVING display */}
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 21</p>
                <h1>Queue / Token Management</h1>
                <p className="subtitle">
                    Create queues, issue tokens, call next in line, and skip tokens on the Stellar network.
                </p>
                <div className="now-serving">
                    <span className="ns-label">Current Wait</span>
                    <span className="ns-count">{waitCount}</span>
                </div>
            </section>

            {/* Tab Navigation */}
            <div className="tab-bar">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        className={`tab-btn ${activeTab === t.key ? "active" : ""}`}
                        onClick={() => setActiveTab(t.key)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab: Create Queue */}
            {activeTab === "create" && (
                <div className="grid-top">
                    <section className="card">
                        <h2>Create Queue</h2>
                        <div className="field">
                            <label htmlFor="id">Queue ID (Symbol)</label>
                            <input id="id" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Unique identifier, e.g. "queue1"</span>
                        </div>
                        <div className="field">
                            <label htmlFor="admin">Admin Address</label>
                            <input id="admin" name="admin" value={form.admin} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key starting with G</span>
                        </div>
                        <div className="field">
                            <label htmlFor="queueName">Queue Name</label>
                            <input id="queueName" name="queueName" value={form.queueName} onChange={setField} />
                        </div>
                        <div className="field">
                            <label htmlFor="maxCapacity">Max Capacity</label>
                            <input id="maxCapacity" name="maxCapacity" value={form.maxCapacity} onChange={setField} type="number" />
                            <span className="helper">Maximum people allowed in queue</span>
                        </div>
                        <button
                            type="button"
                            className={`btn-primary full-width ${loadingAction === "createQueue" ? "btn-loading" : ""}`}
                            onClick={onCreateQueue}
                            disabled={isBusy}
                        >
                            Create Queue
                        </button>
                    </section>
                </div>
            )}

            {/* Tab: Operations */}
            {activeTab === "operations" && (
                <div className="grid-top">
                    <section className="card token-panel">
                        <h2>Token Operations</h2>
                        <div className="field">
                            <label htmlFor="customer">Customer Address</label>
                            <input id="customer" name="customer" value={form.customer} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key of the customer</span>
                        </div>
                        <div className="token-display">
                            <div className="token-number-box">
                                <div className="tn-label">Token #</div>
                                <div className="tn-value">{form.tokenNumber}</div>
                            </div>
                        </div>
                        <div className="field">
                            <label htmlFor="tokenNumber">Token Number (for skip)</label>
                            <input id="tokenNumber" name="tokenNumber" value={form.tokenNumber} onChange={setField} type="number" />
                            <span className="helper">Integer token number to skip</span>
                        </div>
                        <div className="token-actions">
                            <button
                                type="button"
                                className={`btn-primary ${loadingAction === "takeToken" ? "btn-loading" : ""}`}
                                onClick={onTakeToken}
                                disabled={isBusy}
                            >
                                Take Token
                            </button>
                            <button
                                type="button"
                                className={`btn-secondary ${loadingAction === "callNext" ? "btn-loading" : ""}`}
                                onClick={onCallNext}
                                disabled={isBusy}
                            >
                                Call Next
                            </button>
                            <button
                                type="button"
                                className={`btn-destructive ${loadingAction === "skipToken" ? "btn-loading" : ""}`}
                                onClick={onSkipToken}
                                disabled={isBusy}
                            >
                                {confirmingBtn === "skip" ? "Confirm?" : "Skip Token"}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {/* Tab: Status */}
            {activeTab === "status" && (
                <section className="card">
                    <h2>Queue Status</h2>
                    <div className="status-bar">
                        <div className="stat-box">
                            <div className="stat-label">Queue ID</div>
                            <div className="stat-value">{form.id}</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-label">Waiting</div>
                            <div className="stat-value">{waitCount}</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-label">Capacity</div>
                            <div className="stat-value">{form.maxCapacity}</div>
                        </div>
                    </div>
                    <div className="query-actions" style={{ marginTop: "1rem" }}>
                        <button
                            type="button"
                            className={`btn-ghost ${loadingAction === "getQueue" ? "btn-loading" : ""}`}
                            onClick={onGetQueue}
                            disabled={isBusy}
                        >
                            Get Queue
                        </button>
                        <button
                            type="button"
                            className={`btn-ghost ${loadingAction === "listQueues" ? "btn-loading" : ""}`}
                            onClick={onListQueues}
                            disabled={isBusy}
                        >
                            List Queues
                        </button>
                        <button
                            type="button"
                            className={`btn-ghost ${loadingAction === "getWait" ? "btn-loading" : ""}`}
                            onClick={onGetWait}
                            disabled={isBusy}
                        >
                            Get Wait Count
                        </button>
                    </div>
                </section>
            )}

            {/* System Log */}
            <section className="card output-panel">
                <h2>System Log</h2>
                <pre id="output" className={`output-box status-${status}`}>
                    {output || "Run an action above to see results here."}
                </pre>
            </section>
        </main>
    );
}
