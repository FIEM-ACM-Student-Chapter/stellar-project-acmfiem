import React, { useRef, useState } from "react";
import { checkConnection, issuePass, approvePass, checkInVisitor, checkOutVisitor, revokePass, getPass, listPasses } from "../lib.js/stellar.js";

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
        id: "pass1",
        host: "",
        visitor: "",
        purpose: "Guest lecture access",
        location: "Innovation Center",
        visitTime: String(nowTs() + 7200),
    });
    const [output, setOutput] = useState("Ready to manage visitor passes.");
    const [status, setStatus] = useState("idle");
    const [walletKey, setWalletKey] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState("");
    const [activeTab, setActiveTab] = useState("pass");
    const [confirmRevoke, setConfirmRevoke] = useState(false);
    const revokeTimer = useRef(null);

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
            visitor: prev.visitor || user.publicKey,
        }));
        return `Wallet: ${user.publicKey}`;
    });

    const onIssuePass = () => runAction("issue", () => issuePass({
        id: form.id.trim(),
        host: form.host.trim(),
        visitor: form.visitor.trim(),
        purpose: form.purpose.trim(),
        location: form.location.trim(),
        visitTime: form.visitTime.trim(),
    }));

    const onApprovePass = () => runAction("approve", () => approvePass(form.id.trim(), form.host.trim()));
    const onCheckIn = () => runAction("checkin", () => checkInVisitor(form.id.trim(), form.visitor.trim()));
    const onCheckOut = () => runAction("checkout", () => checkOutVisitor(form.id.trim(), form.visitor.trim()));

    const onRevokePass = () => {
        if (confirmRevoke) {
            clearTimeout(revokeTimer.current);
            setConfirmRevoke(false);
            runAction("revoke", () => revokePass(form.id.trim(), form.host.trim()));
            return;
        }

        setConfirmRevoke(true);
        revokeTimer.current = setTimeout(() => setConfirmRevoke(false), 3000);
    };

    const onGetPass = () => runAction("get", () => getPass(form.id.trim()));
    const onListPasses = () => runAction("list", () => listPasses());

    const btnClass = (actionName, extra = "") => [extra, loadingAction === actionName ? "btn-loading" : ""].filter(Boolean).join(" ");
    const outputClass = status === "success" ? "output-success" : status === "error" ? "output-error" : "output-idle";
    const tabs = [
        { key: "pass", label: "Pass" },
        { key: "visit", label: "Visit Flow" },
        { key: "lookup", label: "Lookup" },
    ];

    return (
        <main className="app">
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 49</p>
                <h1>Visitor Pass Management</h1>
                <p className="subtitle">Issue access passes, approve visits, and record check-in and check-out events on Stellar.</p>
                <div className="hero-stats">
                    <span className="stat-chip">Purpose: {form.purpose || "-"}</span>
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

            {activeTab === "pass" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Issue Pass</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="id">Pass ID</label>
                                <input id="id" name="id" value={form.id} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="host">Host Address</label>
                                <input id="host" name="host" value={form.host} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field">
                                <label htmlFor="visitor">Visitor Address</label>
                                <input id="visitor" name="visitor" value={form.visitor} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field">
                                <label htmlFor="location">Location</label>
                                <input id="location" name="location" value={form.location} onChange={setField} />
                            </div>
                            <div className="field full">
                                <label htmlFor="purpose">Purpose</label>
                                <input id="purpose" name="purpose" value={form.purpose} onChange={setField} />
                            </div>
                            <div className="field full">
                                <label htmlFor="visitTime">Visit Time (u64)</label>
                                <input id="visitTime" name="visitTime" value={form.visitTime} onChange={setField} type="number" />
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("issue", "btn-primary")} onClick={onIssuePass} disabled={isBusy}>
                                Issue Pass
                            </button>
                            <button type="button" className={btnClass("approve", "btn-ghost")} onClick={onApprovePass} disabled={isBusy}>
                                Approve Pass
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === "visit" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Visit Flow</h2>
                    </div>
                    <div className="card-body">
                        <div className="actions">
                            <button type="button" className={btnClass("checkin", "btn-primary")} onClick={onCheckIn} disabled={isBusy}>
                                Check In Visitor
                            </button>
                            <button type="button" className={btnClass("checkout", "btn-ghost")} onClick={onCheckOut} disabled={isBusy}>
                                Check Out Visitor
                            </button>
                            <button type="button" className={btnClass("revoke", "btn-warning")} onClick={onRevokePass} disabled={isBusy}>
                                {confirmRevoke ? "Confirm Revoke?" : "Revoke Pass"}
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
                            <button type="button" className={btnClass("get", "btn-ghost")} onClick={onGetPass} disabled={isBusy}>
                                Get Pass
                            </button>
                            <button type="button" className={btnClass("list", "btn-ghost")} onClick={onListPasses} disabled={isBusy}>
                                List Passes
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
