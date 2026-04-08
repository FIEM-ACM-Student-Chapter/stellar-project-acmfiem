import React, { useState } from "react";
import { checkConnection, submitCredential, verifyCredential, revokeCredential, checkValidity, getCredential, listCredentials, getCredentialCount } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);
const oneYearFromNow = () => nowTs() + 365 * 24 * 60 * 60;

const initialForm = () => ({
    id: "cred1",
    holder: "",
    verifier: "",
    credentialType: "certificate",
    issuerName: "Example University",
    dataHash: "abc123hash",
    issuedAt: String(nowTs()),
    expiresAt: String(oneYearFromNow()),
});

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const truncateAddr = (addr) => addr ? addr.slice(0, 8) + "..." + addr.slice(-4) : "";

export default function App() {
    const [form, setForm] = useState(initialForm);
    const [output, setOutput] = useState("Ready.");
    const [walletState, setWalletState] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [countValue, setCountValue] = useState("-");
    const [loadingAction, setLoadingAction] = useState(null);
    const [status, setStatus] = useState("idle");
    const [activeTab, setActiveTab] = useState("submit");
    const [confirmAction, setConfirmAction] = useState(null);

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

    const handleDestructive = (actionName, fn) => {
        if (confirmAction === actionName) {
            setConfirmAction(null);
            fn();
        } else {
            setConfirmAction(actionName);
            setTimeout(() => setConfirmAction(null), 3000);
        }
    };

    const onConnect = () => runAction("connect", async () => {
        const user = await checkConnection();
        if (user) {
            setWalletState(user.publicKey);
            setForm((prev) => ({ ...prev, holder: user.publicKey, verifier: user.publicKey }));
        } else {
            setWalletState(null);
        }
        return user ? `Connected: ${user.publicKey}` : "Wallet: not connected";
    });

    const onSubmitCredential = () => runAction("submitCredential", async () => submitCredential({
        id: form.id.trim(),
        holder: form.holder.trim(),
        credentialType: form.credentialType.trim(),
        issuerName: form.issuerName.trim(),
        dataHash: form.dataHash.trim(),
        issuedAt: Number(form.issuedAt.trim() || nowTs()),
        expiresAt: Number(form.expiresAt.trim() || oneYearFromNow()),
    }));

    const onVerifyCredential = () => runAction("verifyCredential", async () => verifyCredential({
        id: form.id.trim(),
        verifier: form.verifier.trim(),
    }));

    const onRevokeCredential = () => runAction("revokeCredential", async () => revokeCredential({
        id: form.id.trim(),
        holder: form.holder.trim(),
    }));

    const onCheckValidity = () => runAction("checkValidity", async () => checkValidity(form.id.trim()));
    const onGetCredential = () => runAction("getCredential", async () => getCredential(form.id.trim()));
    const onListCredentials = () => runAction("listCredentials", async () => listCredentials());

    const onGetCount = () => runAction("getCount", async () => {
        const value = await getCredentialCount();
        setCountValue(String(value));
        return { count: value };
    });

    const btnClass = (actionName, base) =>
        `${base}${loadingAction === actionName ? " btn-loading" : ""}`;

    const tabs = [
        { key: "submit", label: "Submit Credential" },
        { key: "verify", label: "Verify & Manage" },
        { key: "lookup", label: "Lookup" },
    ];

    return (
        <main className="app">
            {/* Wallet Status Bar */}
            <div className="wallet-bar">
                {walletState ? (
                    <>
                        <span className="status-dot connected"></span>
                        <span className="wallet-addr">{truncateAddr(walletState)}</span>
                        <span className="wallet-badge">Connected</span>
                    </>
                ) : (
                    <>
                        <span className="status-dot disconnected"></span>
                        <span className="wallet-label">Not Connected</span>
                        <button type="button" className={btnClass("connect", "btn-connect")} onClick={onConnect} disabled={isBusy}>
                            Connect Freighter
                        </button>
                    </>
                )}
            </div>

            {/* Hero */}
            <section className="hero">
                <div className="hero-shield">{"\u{1F6E1}"}</div>
                <p className="kicker">Stellar Soroban Project 7</p>
                <h1>Credential Verification</h1>
                <p className="subtitle">
                    Submit, verify, and manage credentials on-chain with expiry and revocation support.
                </p>
                <div className="credential-count">
                    Credentials stored: <strong>{countValue}</strong>
                </div>
            </section>

            {/* Tab Navigation */}
            <nav className="tab-nav">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        className={`tab-btn${activeTab === t.key ? " active" : ""}`}
                        onClick={() => setActiveTab(t.key)}
                    >
                        {t.label}
                    </button>
                ))}
            </nav>

            {/* Submit Credential */}
            {activeTab === "submit" && (
                <section className="card gold-border">
                    <div className="card-header">
                        <span className="badge-icon gold">{"\u{1F4DC}"}</span>
                        <h2>Submit Credential</h2>
                    </div>
                    <div className="form-stack">
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="entryId">Credential ID</label>
                                <input id="entryId" name="id" value={form.id} onChange={setField} />
                                <span className="helper">Unique identifier, max 32 characters</span>
                            </div>
                            <div className="form-group">
                                <label htmlFor="credentialType">Type</label>
                                <input id="credentialType" name="credentialType" value={form.credentialType} onChange={setField} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="holder">Holder Address</label>
                            <input id="holder" name="holder" value={form.holder} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key starting with G...</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="issuerName">Issuer Name</label>
                            <input id="issuerName" name="issuerName" value={form.issuerName} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="dataHash">Data Hash</label>
                            <input id="dataHash" name="dataHash" value={form.dataHash} onChange={setField} />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="issuedAt">Issued At (timestamp)</label>
                                <input id="issuedAt" name="issuedAt" value={form.issuedAt} onChange={setField} type="number" />
                                <span className="helper">Unix timestamp in seconds</span>
                            </div>
                            <div className="form-group">
                                <label htmlFor="expiresAt">Expires At (timestamp)</label>
                                <input id="expiresAt" name="expiresAt" value={form.expiresAt} onChange={setField} type="number" />
                                <span className="helper">Unix timestamp in seconds</span>
                            </div>
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className={btnClass("submitCredential", "btn btn-gold")} onClick={onSubmitCredential} disabled={isBusy}>Submit Credential</button>
                    </div>
                </section>
            )}

            {/* Verify & Manage */}
            {activeTab === "verify" && (
                <section className="card">
                    <div className="card-header">
                        <span className="badge-icon">{"\u2714"}</span>
                        <h2>Verification Actions</h2>
                    </div>
                    <div className="form-stack">
                        <div className="form-group">
                            <label htmlFor="verifier">Verifier Address</label>
                            <input id="verifier" name="verifier" value={form.verifier} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key starting with G...</span>
                        </div>
                    </div>

                    <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span className="badge-verified">{"\u2713"} Verify</span>
                        <span className="badge-revoked">{"\u2717"} Revoke</span>
                    </div>

                    <div className="actions">
                        <button type="button" className={btnClass("verifyCredential", "btn btn-teal")} onClick={onVerifyCredential} disabled={isBusy}>Verify</button>
                        <button
                            type="button"
                            className={btnClass("revokeCredential", `btn btn-danger-outline${confirmAction === "revokeCredential" ? " btn-confirm-pulse" : ""}`)}
                            onClick={() => handleDestructive("revokeCredential", onRevokeCredential)}
                            disabled={isBusy}
                        >
                            {confirmAction === "revokeCredential" ? "Confirm Revoke?" : "Revoke"}
                        </button>
                    </div>
                    <div className="actions-query">
                        <button type="button" className={btnClass("checkValidity", "btn btn-ghost")} onClick={onCheckValidity} disabled={isBusy}>Check Validity</button>
                    </div>
                </section>
            )}

            {/* Lookup */}
            {activeTab === "lookup" && (
                <section className="card">
                    <div className="card-header">
                        <span className="badge-icon">{"\u{1F50E}"}</span>
                        <h2>Credential Lookup</h2>
                    </div>
                    <div className="actions-query">
                        <button type="button" className={btnClass("getCredential", "btn btn-teal")} onClick={onGetCredential} disabled={isBusy}>Get Credential</button>
                        <button type="button" className={btnClass("listCredentials", "btn btn-ghost")} onClick={onListCredentials} disabled={isBusy}>List All</button>
                        <button type="button" className={btnClass("getCount", "btn btn-ghost")} onClick={onGetCount} disabled={isBusy}>Get Count</button>
                    </div>
                </section>
            )}

            {/* Audit Trail */}
            <section className="audit-trail">
                <div className="audit-header">
                    {"\u{1F4CB}"} Audit Trail
                </div>
                <div className={`audit-body output-${status}`}>
                    {output === "Ready." ? (
                        <p className="empty-state">Connect your wallet and perform an action to see results here.</p>
                    ) : (
                        <pre id="output">{output}</pre>
                    )}
                </div>
            </section>
        </main>
    );
}
