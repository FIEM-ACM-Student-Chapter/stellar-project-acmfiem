import React, { useState } from "react";
import { checkConnection, createInvoice, markPaid, markOverdue, cancelInvoice, getInvoice, listInvoices, getTotalOutstanding } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);
const thirtyDaysFromNow = () => nowTs() + 30 * 24 * 60 * 60;

const initialForm = () => ({
    id: "inv1",
    issuer: "",
    recipient: "",
    payer: "",
    description: "Web development services",
    amount: "10000",
    paidAmount: "10000",
    dueDate: String(thirtyDaysFromNow()),
    paidAt: String(nowTs()),
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
    const [loadingAction, setLoadingAction] = useState(null);
    const [status, setStatus] = useState("idle");
    const [activeTab, setActiveTab] = useState("create");
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
            setForm((prev) => ({ ...prev, issuer: user.publicKey, recipient: user.publicKey, payer: user.publicKey }));
        } else {
            setWalletState(null);
        }
        return user ? `Connected: ${user.publicKey}` : "Wallet: not connected";
    });

    const onCreateInvoice = () => runAction("createInvoice", async () => createInvoice({
        id: form.id.trim(),
        issuer: form.issuer.trim(),
        recipient: form.recipient.trim(),
        description: form.description.trim(),
        amount: form.amount.trim(),
        dueDate: Number(form.dueDate.trim() || thirtyDaysFromNow()),
    }));

    const onMarkPaid = () => runAction("markPaid", async () => markPaid({
        id: form.id.trim(),
        payer: form.payer.trim(),
        paidAmount: form.paidAmount.trim(),
        paidAt: Number(form.paidAt.trim() || nowTs()),
    }));

    const onMarkOverdue = () => runAction("markOverdue", async () => markOverdue({
        id: form.id.trim(),
        issuer: form.issuer.trim(),
    }));

    const onCancelInvoice = () => runAction("cancelInvoice", async () => cancelInvoice({
        id: form.id.trim(),
        issuer: form.issuer.trim(),
    }));

    const onGetInvoice = () => runAction("getInvoice", async () => getInvoice(form.id.trim()));
    const onListInvoices = () => runAction("listInvoices", async () => listInvoices());
    const onGetTotalOutstanding = () => runAction("getTotalOutstanding", async () => getTotalOutstanding());

    const btnClass = (actionName, base) =>
        `${base}${loadingAction === actionName ? " btn-loading" : ""}`;

    const tabs = [
        { key: "create", label: "Create Invoice" },
        { key: "payment", label: "Payment Actions" },
        { key: "queries", label: "Queries" },
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
                <span className="hero-icon">{"\u{1F4B2}"}</span>
                <p className="kicker">Stellar Soroban Project 10</p>
                <h1>Payment Tracking System</h1>
                <p className="subtitle">
                    Create invoices, track payments, manage overdue accounts, and view outstanding balances on-chain.
                </p>
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

            {/* Create Invoice */}
            {activeTab === "create" && (
                <section className="card">
                    <div className="card-header">
                        <span className="icon">$</span>
                        <h2>Create Invoice</h2>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="entryId">Invoice ID</label>
                            <input id="entryId" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Unique identifier, max 32 characters</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="dueDate">Due Date (timestamp)</label>
                            <input id="dueDate" name="dueDate" value={form.dueDate} onChange={setField} type="number" />
                            <span className="helper">Unix timestamp in seconds</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="issuer">Issuer Address</label>
                            <input id="issuer" name="issuer" value={form.issuer} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key starting with G...</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="recipient">Recipient Address</label>
                            <input id="recipient" name="recipient" value={form.recipient} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key starting with G...</span>
                        </div>
                        <div className="form-group full">
                            <label htmlFor="description">Description</label>
                            <textarea id="description" name="description" rows="2" value={form.description} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="amount">Amount</label>
                            <div className="currency-wrap">
                                <input id="amount" name="amount" value={form.amount} onChange={setField} type="number" />
                            </div>
                            <span className="helper">Amount in stroops (1 XLM = 10,000,000)</span>
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className={btnClass("createInvoice", "btn btn-green")} onClick={onCreateInvoice} disabled={isBusy}>Create Invoice</button>
                    </div>
                </section>
            )}

            {/* Payment Actions */}
            {activeTab === "payment" && (
                <section className="payment-bar">
                    <div className="payment-bar-title">Payment Actions</div>
                    <div className="payment-fields">
                        <div className="form-group">
                            <label htmlFor="payer">Payer Address</label>
                            <input id="payer" name="payer" value={form.payer} onChange={setField} placeholder="G..." />
                            <span className="helper helper-light">Stellar public key starting with G...</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="paidAmount">Paid Amount</label>
                            <div className="currency-wrap">
                                <input id="paidAmount" name="paidAmount" value={form.paidAmount} onChange={setField} type="number" />
                            </div>
                            <span className="helper helper-light">Amount in stroops (1 XLM = 10,000,000)</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="paidAt">Paid At (timestamp)</label>
                            <input id="paidAt" name="paidAt" value={form.paidAt} onChange={setField} type="number" />
                            <span className="helper helper-light">Unix timestamp in seconds</span>
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className={btnClass("markPaid", "btn btn-green")} onClick={onMarkPaid} disabled={isBusy}>Mark Paid</button>
                        <button type="button" className={btnClass("markOverdue", "btn btn-amber")} onClick={onMarkOverdue} disabled={isBusy}>Mark Overdue</button>
                        <button
                            type="button"
                            className={btnClass("cancelInvoice", `btn btn-danger-outline${confirmAction === "cancelInvoice" ? " btn-confirm-pulse" : ""}`)}
                            onClick={() => handleDestructive("cancelInvoice", onCancelInvoice)}
                            disabled={isBusy}
                        >
                            {confirmAction === "cancelInvoice" ? "Confirm Cancel?" : "Cancel Invoice"}
                        </button>
                    </div>
                </section>
            )}

            {/* Financial Queries */}
            {activeTab === "queries" && (
                <section className="card">
                    <div className="card-header">
                        <span className="icon">{"\u{1F4CA}"}</span>
                        <h2>Financial Queries</h2>
                    </div>
                    <div className="actions-query">
                        <button type="button" className={btnClass("getInvoice", "btn btn-green")} onClick={onGetInvoice} disabled={isBusy}>Lookup Invoice</button>
                        <button type="button" className={btnClass("listInvoices", "btn btn-ghost")} onClick={onListInvoices} disabled={isBusy}>All Invoices</button>
                        <button type="button" className={btnClass("getTotalOutstanding", "btn btn-ghost")} onClick={onGetTotalOutstanding} disabled={isBusy}>Outstanding Total</button>
                    </div>
                </section>
            )}

            {/* Transaction Log */}
            <section className="transaction-log">
                <div className="log-header">
                    {"\u{1F4C4}"} Transaction Log
                </div>
                <div className={`log-body output-${status}`}>
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
