import React, { useState, useRef, useEffect } from "react";
import { checkConnection, registerMentor, requestMentorship, acceptMentee, completeSession, rateMentor, getMentor, listMentors, getMentorCount } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const truncateAddress = (addr) => {
    if (!addr || addr.length < 12) return addr;
    return addr.slice(0, 6) + "..." + addr.slice(-4);
};

export default function App() {
    const [form, setForm] = useState({
        id: "mentor1",
        mentor: "",
        name: "Alice",
        expertise: "rust",
        bio: "Experienced Soroban developer",
        hourlyRate: "100",
        maxMentees: "5",
        mentee: "",
        message: "I'd like to learn Soroban",
        hours: "2",
        sessionNotes: "Covered contract basics",
        rating: "5",
    });
    const [output, setOutput] = useState("");
    const [walletState, setWalletState] = useState("Wallet: not connected");
    const [isBusy, setIsBusy] = useState(false);
    const [countValue, setCountValue] = useState("-");
    const [loadingAction, setLoadingAction] = useState(null);
    const [status, setStatus] = useState("idle");
    const [activeTab, setActiveTab] = useState(0);
    const [connectedAddress, setConnectedAddress] = useState("");
    const [confirmAction, setConfirmAction] = useState(null);
    const confirmTimer = useRef(null);

    useEffect(() => {
        return () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); };
    }, []);

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

    const handleConfirm = (actionName, action) => {
        if (confirmAction === actionName) {
            setConfirmAction(null);
            if (confirmTimer.current) clearTimeout(confirmTimer.current);
            action();
        } else {
            setConfirmAction(actionName);
            if (confirmTimer.current) clearTimeout(confirmTimer.current);
            confirmTimer.current = setTimeout(() => setConfirmAction(null), 3000);
        }
    };

    const onConnect = () => runAction("connect", async () => {
        const user = await checkConnection();
        const nextWalletState = user ? `Wallet: ${user.publicKey}` : "Wallet: not connected";
        setWalletState(nextWalletState);
        if (user) {
            setConnectedAddress(user.publicKey);
            setForm((prev) => ({ ...prev, mentor: prev.mentor || user.publicKey, mentee: prev.mentee || user.publicKey }));
        }
        return nextWalletState;
    });

    const onRegister = () => runAction("register", async () => registerMentor({
        id: form.id.trim(),
        mentor: form.mentor.trim(),
        name: form.name.trim(),
        expertise: form.expertise.trim(),
        bio: form.bio.trim(),
        hourlyRate: form.hourlyRate.trim(),
        maxMentees: form.maxMentees.trim(),
    }));

    const onRequestMentorship = () => runAction("requestMentorship", async () => requestMentorship({
        mentorId: form.id.trim(),
        mentee: form.mentee.trim(),
        message: form.message.trim(),
    }));

    const onAcceptMentee = () => runAction("acceptMentee", async () => acceptMentee({
        mentorId: form.id.trim(),
        mentor: form.mentor.trim(),
        mentee: form.mentee.trim(),
    }));

    const onCompleteSession = () => runAction("completeSession", async () => completeSession({
        mentorId: form.id.trim(),
        mentor: form.mentor.trim(),
        hours: form.hours.trim(),
        sessionNotes: form.sessionNotes.trim(),
    }));

    const onRate = () => runAction("rate", async () => rateMentor({
        mentorId: form.id.trim(),
        mentee: form.mentee.trim(),
        rating: form.rating.trim(),
    }));

    const onGetMentor = () => runAction("getMentor", async () => getMentor(form.id.trim()));

    const onList = () => runAction("list", async () => listMentors());

    const onCount = () => runAction("count", async () => {
        const value = await getMentorCount();
        setCountValue(String(value));
        return { count: value };
    });

    const tabs = ["Register", "Mentorship", "Rate & Browse"];

    return (
        <main className="app">
            {/* ---- Wallet Status Bar ---- */}
            <div className="wallet-status-bar">
                <span className={`wallet-dot ${connectedAddress ? "connected" : ""}`} />
                <span className="wallet-status-text">
                    {connectedAddress ? truncateAddress(connectedAddress) : "Not connected"}
                </span>
            </div>

            {/* ---- Hero ---- */}
            <section className="hero">
                <div className="hero-icon">&#128101;</div>
                <h1>Mentorship Platform</h1>
                <p className="subtitle">Grow your skills with expert mentors on the Stellar network.</p>

                <div className="wallet-bar">
                    <button type="button" id="connectWallet" onClick={onConnect} className={loadingAction === "connect" ? "btn-loading" : ""} disabled={isBusy}>
                        Connect Freighter
                    </button>
                    <span className="wallet-text" id="walletState">{walletState}</span>
                </div>

                <p className="mentor-count">
                    Registered mentors: <span>{countValue}</span>
                </p>
            </section>

            {/* ---- Tab Navigation ---- */}
            <div className="tab-bar">
                {tabs.map((tab, i) => (
                    <button
                        key={tab}
                        type="button"
                        className={`tab-btn ${activeTab === i ? "active" : ""}`}
                        onClick={() => setActiveTab(i)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* ---- Tab 0: Register as Mentor ---- */}
            {activeTab === 0 && (
                <section className="card profile-card">
                    <div className="card-header">
                        <span className="card-icon">&#128100;</span>
                        <h2>Register as Mentor</h2>
                    </div>

                    <div className="form-grid">
                        <div className="field">
                            <label htmlFor="id">Mentor ID (Symbol)</label>
                            <input id="id" name="id" value={form.id} onChange={setField} />
                            <span className="field-helper">Unique identifier for your mentor profile</span>
                        </div>
                        <div className="field">
                            <label htmlFor="mentor">Mentor Address</label>
                            <input id="mentor" name="mentor" value={form.mentor} onChange={setField} placeholder="G..." />
                            <span className="field-helper">Your Stellar wallet address (auto-filled on connect)</span>
                        </div>
                        <div className="field">
                            <label htmlFor="name">Display Name</label>
                            <input id="name" name="name" value={form.name} onChange={setField} />
                        </div>
                        <div className="field">
                            <label htmlFor="expertise">Expertise (Symbol)</label>
                            <input id="expertise" name="expertise" value={form.expertise} onChange={setField} />
                            {form.expertise && (
                                <div className="expertise-display">
                                    <span className="chip">{form.expertise}</span>
                                </div>
                            )}
                        </div>
                        <div className="field full-width">
                            <label htmlFor="bio">Bio</label>
                            <textarea id="bio" name="bio" rows="2" value={form.bio} onChange={setField} />
                            <span className="field-helper">A short description of your experience and teaching style</span>
                        </div>
                        <div className="field">
                            <label htmlFor="hourlyRate">Hourly Rate (i128)</label>
                            <input id="hourlyRate" name="hourlyRate" value={form.hourlyRate} onChange={setField} type="number" />
                            <span className="field-helper">Rate in stroops (1 XLM = 10,000,000)</span>
                        </div>
                        <div className="field">
                            <label htmlFor="maxMentees">Max Mentees</label>
                            <input id="maxMentees" name="maxMentees" value={form.maxMentees} onChange={setField} type="number" />
                        </div>
                    </div>

                    <div className="actions">
                        <button type="button" className={`btn ${loadingAction === "register" ? "btn-loading" : ""}`} onClick={onRegister} disabled={isBusy}>Register Mentor</button>
                    </div>
                </section>
            )}

            {/* ---- Tab 1: Mentorship Actions ---- */}
            {activeTab === 1 && (
                <section className="card">
                    <div className="card-header">
                        <span className="card-icon">&#129309;</span>
                        <h2>Mentorship Actions</h2>
                    </div>

                    <div className="form-grid">
                        <div className="field">
                            <label htmlFor="mentee">Mentee Address</label>
                            <input id="mentee" name="mentee" value={form.mentee} onChange={setField} placeholder="G..." />
                            <span className="field-helper">Stellar address of the mentee</span>
                        </div>
                        <div className="field">
                            <label htmlFor="message">Request Message</label>
                            <input id="message" name="message" value={form.message} onChange={setField} />
                        </div>
                        <div className="field">
                            <label htmlFor="hours">Session Hours</label>
                            <input id="hours" name="hours" value={form.hours} onChange={setField} type="number" />
                        </div>
                        <div className="field full-width">
                            <label htmlFor="sessionNotes">Session Notes</label>
                            <textarea id="sessionNotes" name="sessionNotes" rows="2" value={form.sessionNotes} onChange={setField} />
                        </div>
                    </div>

                    <div className="actions">
                        <button type="button" className={`btn ${loadingAction === "requestMentorship" ? "btn-loading" : ""}`} onClick={onRequestMentorship} disabled={isBusy}>Request Mentorship</button>
                        <button type="button" className={`btn btn-secondary ${loadingAction === "acceptMentee" ? "btn-loading" : ""}`} onClick={onAcceptMentee} disabled={isBusy}>Accept Mentee</button>
                        <button type="button" className={`btn btn-secondary ${loadingAction === "completeSession" ? "btn-loading" : ""}`} onClick={onCompleteSession} disabled={isBusy}>Complete Session</button>
                    </div>
                </section>
            )}

            {/* ---- Tab 2: Rate & Browse ---- */}
            {activeTab === 2 && (
                <>
                    <section className="card">
                        <div className="card-header">
                            <span className="card-icon">&#11088;</span>
                            <h2>Rate &amp; Review</h2>
                        </div>

                        <div className="form-grid">
                            <div className="field">
                                <label htmlFor="rating">Rating (1-5)</label>
                                <input id="rating" name="rating" value={form.rating} onChange={setField} type="number" min="1" max="5" />
                                <span className="field-helper">Rate your mentor from 1 (poor) to 5 (excellent)</span>
                            </div>
                        </div>

                        <div className="actions">
                            <button type="button" className={`btn ${loadingAction === "rate" ? "btn-loading" : ""}`} onClick={onRate} disabled={isBusy}>Rate Mentor</button>
                        </div>
                    </section>

                    <section className="card">
                        <div className="card-header">
                            <span className="card-icon">&#128218;</span>
                            <h2>Mentor Directory</h2>
                        </div>

                        <div className="actions">
                            <button type="button" className={`btn btn-ghost ${loadingAction === "getMentor" ? "btn-loading" : ""}`} onClick={onGetMentor} disabled={isBusy}>Get Mentor</button>
                            <button type="button" className={`btn btn-ghost ${loadingAction === "list" ? "btn-loading" : ""}`} onClick={onList} disabled={isBusy}>List Mentors</button>
                            <button type="button" className={`btn btn-ghost ${loadingAction === "count" ? "btn-loading" : ""}`} onClick={onCount} disabled={isBusy}>Get Count</button>
                        </div>
                    </section>
                </>
            )}

            {/* ---- Output ---- */}
            <section className="card output-card">
                <div className="card-header">
                    <span className="card-icon">&#128196;</span>
                    <h2>Output</h2>
                </div>
                <pre id="output" className={`output-pre status-${status}`}>
                    {output || "Connect your wallet and interact with the mentorship contract. Results will appear here."}
                </pre>
            </section>
        </main>
    );
}
