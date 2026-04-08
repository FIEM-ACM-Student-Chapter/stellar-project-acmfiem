import React, { useState } from "react";
import { checkConnection, addProduct, updateStock, updatePrice, discontinueProduct, getProduct, listProducts, getLowStock, getTotalValue } from "../lib.js/stellar.js";


const nowTs = () => Math.floor(Date.now() / 1000);

const initialForm = () => ({
    id: "prod1",
    owner: "",
    name: "Sample Product",
    sku: "SKU-001",
    quantity: "10",
    unitPrice: "1000",
    category: "general",
    quantityChange: "5",
    isAddition: true,
    newPrice: "1500",
    lowStockThreshold: "5",
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
    const [activeTab, setActiveTab] = useState("add");
    const [confirmAction, setConfirmAction] = useState(null);

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
            setForm((prev) => ({ ...prev, owner: user.publicKey }));
        } else {
            setWalletState(null);
        }
        return user ? `Connected: ${user.publicKey}` : "Wallet: not connected";
    });

    const onAddProduct = () => runAction("addProduct", async () => addProduct({
        id: form.id.trim(),
        owner: form.owner.trim(),
        name: form.name.trim(),
        sku: form.sku.trim(),
        quantity: form.quantity.trim(),
        unitPrice: form.unitPrice.trim(),
        category: form.category.trim(),
    }));

    const onUpdateStock = () => runAction("updateStock", async () => updateStock({
        id: form.id.trim(),
        owner: form.owner.trim(),
        quantityChange: form.quantityChange.trim(),
        isAddition: form.isAddition,
    }));

    const onUpdatePrice = () => runAction("updatePrice", async () => updatePrice({
        id: form.id.trim(),
        owner: form.owner.trim(),
        newPrice: form.newPrice.trim(),
    }));

    const onDiscontinue = () => runAction("discontinue", async () => discontinueProduct({
        id: form.id.trim(),
        owner: form.owner.trim(),
    }));

    const onGetProduct = () => runAction("getProduct", async () => getProduct(form.id.trim()));
    const onListProducts = () => runAction("listProducts", async () => listProducts());
    const onGetLowStock = () => runAction("getLowStock", async () => getLowStock(form.lowStockThreshold.trim()));
    const onGetTotalValue = () => runAction("getTotalValue", async () => getTotalValue());

    const btnClass = (actionName, base) =>
        `${base}${loadingAction === actionName ? " btn-loading" : ""}`;

    const tabs = [
        { key: "add", label: "Add Product" },
        { key: "stock", label: "Stock & Price" },
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
                <span className="hero-icon">{"\u{1F4E6}"}</span>
                <p className="kicker">Stellar Soroban Project 6</p>
                <h1>Inventory Management System</h1>
                <p className="subtitle">
                    Manage products, track stock levels, update prices, and monitor inventory value on-chain.
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

            {/* Add Product */}
            {activeTab === "add" && (
                <section className="card">
                    <div className="card-header">
                        <span className="icon">{"\u{1F4CB}"}</span>
                        <h2>Add Product</h2>
                    </div>
                    <div className="form-grid cols-3">
                        <div className="form-group">
                            <label htmlFor="entryId">Product ID</label>
                            <input id="entryId" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Unique identifier, max 32 characters</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="owner">Owner Address</label>
                            <input id="owner" name="owner" value={form.owner} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key starting with G...</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="name">Product Name</label>
                            <input id="name" name="name" value={form.name} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="sku">SKU</label>
                            <input id="sku" name="sku" value={form.sku} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="quantity">Quantity</label>
                            <input id="quantity" name="quantity" value={form.quantity} onChange={setField} type="number" />
                            <span className="helper">Whole number</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="unitPrice">Unit Price</label>
                            <input id="unitPrice" name="unitPrice" value={form.unitPrice} onChange={setField} type="number" />
                            <span className="helper">Amount in stroops (1 XLM = 10,000,000)</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="category">Category</label>
                            <input id="category" name="category" value={form.category} onChange={setField} />
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className={btnClass("addProduct", "btn btn-primary")} onClick={onAddProduct} disabled={isBusy}>Add Product</button>
                    </div>
                    <div className="actions-query">
                        <button type="button" className={btnClass("getProduct", "btn btn-ghost")} onClick={onGetProduct} disabled={isBusy}>Get Product</button>
                        <button type="button" className={btnClass("listProducts", "btn btn-ghost")} onClick={onListProducts} disabled={isBusy}>List Products</button>
                    </div>
                </section>
            )}

            {/* Stock & Price Control */}
            {activeTab === "stock" && (
                <section className="stock-bar">
                    <div className="form-group">
                        <label htmlFor="quantityChange">Qty Change</label>
                        <input id="quantityChange" name="quantityChange" value={form.quantityChange} onChange={setField} type="number" />
                        <span className="helper helper-light">Whole number</span>
                    </div>
                    <div className="checkbox-row">
                        <input type="checkbox" id="isAddition" name="isAddition" checked={form.isAddition} onChange={setField} />
                        <span>Add stock (uncheck to remove)</span>
                    </div>
                    <div className="form-group">
                        <label htmlFor="newPrice">New Price</label>
                        <input id="newPrice" name="newPrice" value={form.newPrice} onChange={setField} type="number" />
                        <span className="helper helper-light">Amount in stroops (1 XLM = 10,000,000)</span>
                    </div>
                    <div className="actions" style={{ marginTop: 0 }}>
                        <button type="button" className={btnClass("updateStock", "btn btn-primary")} onClick={onUpdateStock} disabled={isBusy}>Update Stock</button>
                        <button type="button" className={btnClass("updatePrice", "btn btn-outline-light")} onClick={onUpdatePrice} disabled={isBusy}>Update Price</button>
                        <button
                            type="button"
                            className={btnClass("discontinue", `btn btn-danger-outline${confirmAction === "discontinue" ? " btn-confirm-pulse" : ""}`)}
                            onClick={() => handleDestructive("discontinue", onDiscontinue)}
                            disabled={isBusy}
                        >
                            {confirmAction === "discontinue" ? "Confirm Discontinue?" : "Discontinue"}
                        </button>
                    </div>
                </section>
            )}

            {/* Queries */}
            {activeTab === "queries" && (
                <section className="card">
                    <div className="card-header">
                        <span className="icon">{"\u{1F50D}"}</span>
                        <h2>Queries</h2>
                    </div>
                    <div className="queries-grid">
                        <div className="query-item">
                            <div className="form-group">
                                <label htmlFor="lowStockThreshold">Low Stock Threshold</label>
                                <input id="lowStockThreshold" name="lowStockThreshold" value={form.lowStockThreshold} onChange={setField} type="number" />
                                <span className="helper">Whole number</span>
                            </div>
                            <button type="button" className={btnClass("getLowStock", "btn btn-ghost")} onClick={onGetLowStock} disabled={isBusy}>Get Low Stock</button>
                        </div>
                        <div className="query-item">
                            <div className="form-group">
                                <label>Total Inventory Value</label>
                                <p style={{ fontSize: "0.85rem", color: "#71717a" }}>Calculate the total value of all products in stock.</p>
                            </div>
                            <button type="button" className={btnClass("getTotalValue", "btn btn-ghost")} onClick={onGetTotalValue} disabled={isBusy}>Get Total Value</button>
                        </div>
                    </div>
                </section>
            )}

            {/* Output Terminal */}
            <section className="output-terminal">
                <div className="terminal-bar">
                    <span className="terminal-dot red"></span>
                    <span className="terminal-dot yellow"></span>
                    <span className="terminal-dot green"></span>
                    <span className="terminal-title">output</span>
                </div>
                <div className={`terminal-body output-${status}`}>
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
