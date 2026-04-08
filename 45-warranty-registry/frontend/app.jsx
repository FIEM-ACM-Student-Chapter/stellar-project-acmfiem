import React, { useState } from "react";
import { checkConnection, registerWarranty, transferWarranty, fileClaim, closeClaim, getWarranty, listWarranties, getWarrantyCount } from "../lib.js/stellar.js";

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
        id: "warranty1",
        owner: "",
        provider: "",
        newOwner: "",
        productName: "Smart Sensor Hub",
        serialNumber: "SN-2026-1001",
        claimNote: "Screen stopped responding after update.",
        purchasedAt: String(nowTs()),
        expiresAt: String(nowTs() + 31536000),
    });
    const [output, setOutput] = useState("Ready to register warranties.");
    const [status, setStatus] = useState("idle");
    const [walletKey, setWalletKey] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState("");
    const [activeTab, setActiveTab] = useState("warranty");
    const [warrantyCount, setWarrantyCount] = useState("-");

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
            owner: prev.owner || user.publicKey,
            provider: prev.provider || user.publicKey,
            newOwner: prev.newOwner || user.publicKey,
        }));
        return `Wallet: ${user.publicKey}`;
    });

    const onRegisterWarranty = () => runAction("register", () => registerWarranty({
        id: form.id.trim(),
        owner: form.owner.trim(),
        provider: form.provider.trim(),
        productName: form.productName.trim(),
        serialNumber: form.serialNumber.trim(),
        purchasedAt: form.purchasedAt.trim(),
        expiresAt: form.expiresAt.trim(),
    }));

    const onTransferWarranty = () => runAction("transfer", () => transferWarranty({
        id: form.id.trim(),
        owner: form.owner.trim(),
        newOwner: form.newOwner.trim(),
    }));

    const onFileClaim = () => runAction("claim", () => fileClaim({
        id: form.id.trim(),
        owner: form.owner.trim(),
        claimNote: form.claimNote.trim(),
    }));

    const onCloseClaim = () => runAction("close", () => closeClaim(form.id.trim(), form.provider.trim()));
    const onGetWarranty = () => runAction("get", () => getWarranty(form.id.trim()));
    const onListWarranties = () => runAction("list", () => listWarranties());
    const onGetCount = () => runAction("count", async () => {
        const value = await getWarrantyCount();
        setWarrantyCount(String(value));
        return { warranties: value };
    });

    const btnClass = (actionName, extra = "") => [extra, loadingAction === actionName ? "btn-loading" : ""].filter(Boolean).join(" ");
    const outputClass = status === "success" ? "output-success" : status === "error" ? "output-error" : "output-idle";
    const tabs = [
        { key: "warranty", label: "Warranty" },
        { key: "claims", label: "Claims" },
        { key: "lookup", label: "Lookup" },
    ];

    return (
        <main className="app">
            <section className="hero">
                <p className="kicker">Stellar Soroban Project 45</p>
                <h1>Warranty Registry</h1>
                <p className="subtitle">Register warranty records, transfer ownership, and track claim handling on-chain.</p>
                <div className="hero-stats">
                    <span className="stat-chip">Records: {warrantyCount}</span>
                    <span className="stat-chip">Serial: {form.serialNumber || "-"}</span>
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

            {activeTab === "warranty" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Register Warranty</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field">
                                <label htmlFor="id">Warranty ID</label>
                                <input id="id" name="id" value={form.id} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="owner">Owner Address</label>
                                <input id="owner" name="owner" value={form.owner} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field">
                                <label htmlFor="provider">Provider Address</label>
                                <input id="provider" name="provider" value={form.provider} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field">
                                <label htmlFor="newOwner">New Owner Address</label>
                                <input id="newOwner" name="newOwner" value={form.newOwner} onChange={setField} placeholder="G..." />
                            </div>
                            <div className="field">
                                <label htmlFor="productName">Product Name</label>
                                <input id="productName" name="productName" value={form.productName} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="serialNumber">Serial Number</label>
                                <input id="serialNumber" name="serialNumber" value={form.serialNumber} onChange={setField} />
                            </div>
                            <div className="field">
                                <label htmlFor="purchasedAt">Purchased At (u64)</label>
                                <input id="purchasedAt" name="purchasedAt" value={form.purchasedAt} onChange={setField} type="number" />
                            </div>
                            <div className="field">
                                <label htmlFor="expiresAt">Expires At (u64)</label>
                                <input id="expiresAt" name="expiresAt" value={form.expiresAt} onChange={setField} type="number" />
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("register", "btn-primary")} onClick={onRegisterWarranty} disabled={isBusy}>
                                Register Warranty
                            </button>
                            <button type="button" className={btnClass("transfer", "btn-ghost")} onClick={onTransferWarranty} disabled={isBusy}>
                                Transfer Warranty
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === "claims" && (
                <section className="card">
                    <div className="card-header">
                        <h2>Claim Handling</h2>
                    </div>
                    <div className="card-body">
                        <div className="field-grid">
                            <div className="field full">
                                <label htmlFor="claimNote">Claim Note</label>
                                <textarea id="claimNote" name="claimNote" rows="3" value={form.claimNote} onChange={setField} />
                            </div>
                        </div>
                        <div className="actions">
                            <button type="button" className={btnClass("claim", "btn-primary")} onClick={onFileClaim} disabled={isBusy}>
                                File Claim
                            </button>
                            <button type="button" className={btnClass("close", "btn-warning")} onClick={onCloseClaim} disabled={isBusy}>
                                Close Claim
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
                            <button type="button" className={btnClass("get", "btn-ghost")} onClick={onGetWarranty} disabled={isBusy}>
                                Get Warranty
                            </button>
                            <button type="button" className={btnClass("list", "btn-ghost")} onClick={onListWarranties} disabled={isBusy}>
                                List Warranties
                            </button>
                            <button type="button" className={btnClass("count", "btn-ghost")} onClick={onGetCount} disabled={isBusy}>
                                Get Warranty Count
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
