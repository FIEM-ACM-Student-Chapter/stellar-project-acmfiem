import React, { useState } from "react";
import { checkConnection, createCourse, enrollStudent, completeCourse, rateCourse, getCourse, listCourses, getEnrollmentCount } from "../lib.js/stellar.js";

const initialForm = () => ({
    id: "course1",
    instructor: "",
    student: "",
    title: "Intro to Soroban",
    description: "Learn smart contract development on Stellar",
    category: "blockchain",
    maxStudents: "30",
    price: "5000",
    rating: "5",
});

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const truncateAddr = (addr) => addr ? addr.slice(0, 8) + "..." + addr.slice(-4) : "";

const StarDisplay = ({ count }) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        stars.push(
            <span key={i} className={`star ${i <= count ? "filled" : ""}`}>
                {"\u2605"}
            </span>
        );
    }
    return (
        <div className="star-rating">
            {stars}
            <span className="star-label">{count} / 5</span>
        </div>
    );
};

export default function App() {
    const [form, setForm] = useState(initialForm);
    const [output, setOutput] = useState("Ready.");
    const [walletState, setWalletState] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [status, setStatus] = useState("idle");
    const [activeTab, setActiveTab] = useState("create");

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
            setForm((prev) => ({ ...prev, instructor: user.publicKey, student: user.publicKey }));
        } else {
            setWalletState(null);
        }
        return user ? `Connected: ${user.publicKey}` : "Wallet: not connected";
    });

    const onCreateCourse = () => runAction("createCourse", async () => createCourse({
        id: form.id.trim(),
        instructor: form.instructor.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        maxStudents: form.maxStudents.trim(),
        price: form.price.trim(),
    }));

    const onEnrollStudent = () => runAction("enrollStudent", async () => enrollStudent({
        courseId: form.id.trim(),
        student: form.student.trim(),
    }));

    const onCompleteCourse = () => runAction("completeCourse", async () => completeCourse({
        courseId: form.id.trim(),
        student: form.student.trim(),
    }));

    const onRateCourse = () => runAction("rateCourse", async () => rateCourse({
        courseId: form.id.trim(),
        student: form.student.trim(),
        rating: form.rating.trim(),
    }));

    const onGetCourse = () => runAction("getCourse", async () => getCourse(form.id.trim()));
    const onListCourses = () => runAction("listCourses", async () => listCourses());
    const onGetEnrollmentCount = () => runAction("getEnrollmentCount", async () => getEnrollmentCount(form.id.trim()));

    const btnClass = (actionName, base) =>
        `${base}${loadingAction === actionName ? " btn-loading" : ""}`;

    const tabs = [
        { key: "create", label: "Create Course" },
        { key: "student", label: "Student Actions" },
        { key: "directory", label: "Directory" },
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
                <span className="hero-icon">{"\u{1F393}"}</span>
                <p className="kicker">Stellar Soroban Project 9</p>
                <h1>Learning Platform</h1>
                <p className="subtitle">
                    "Education is the passport to the future." -- Create courses, enroll students, and track progress on-chain.
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

            {/* Create Course */}
            {activeTab === "create" && (
                <section className="card">
                    <div className="card-header">
                        <span className="icon">{"\u{1F4DA}"}</span>
                        <h2>Create Course</h2>
                    </div>
                    <div className="form-stack">
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="entryId">Course ID</label>
                                <input id="entryId" name="id" value={form.id} onChange={setField} />
                                <span className="helper">Unique identifier, max 32 characters</span>
                            </div>
                            <div className="form-group">
                                <label htmlFor="category">Category</label>
                                <input id="category" name="category" value={form.category} onChange={setField} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="instructor">Instructor Address</label>
                            <input id="instructor" name="instructor" value={form.instructor} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key starting with G...</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="title">Title</label>
                            <input id="title" name="title" value={form.title} onChange={setField} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="description">Description</label>
                            <textarea id="description" name="description" rows="3" value={form.description} onChange={setField} />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="maxStudents">Max Students</label>
                                <input id="maxStudents" name="maxStudents" value={form.maxStudents} onChange={setField} type="number" />
                                <span className="helper">Whole number</span>
                            </div>
                            <div className="form-group">
                                <label htmlFor="price">Price</label>
                                <input id="price" name="price" value={form.price} onChange={setField} type="number" />
                                <span className="helper">Amount in stroops (1 XLM = 10,000,000)</span>
                            </div>
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className={btnClass("createCourse", "btn btn-sky")} onClick={onCreateCourse} disabled={isBusy}>Create Course</button>
                    </div>
                </section>
            )}

            {/* Student Actions */}
            {activeTab === "student" && (
                <section className="card">
                    <div className="card-header">
                        <span className="icon">{"\u{1F9D1}"}</span>
                        <h2>Student Actions</h2>
                    </div>
                    <div className="form-stack">
                        <div className="form-group">
                            <label htmlFor="student">Student Address</label>
                            <input id="student" name="student" value={form.student} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key starting with G...</span>
                        </div>

                        <div>
                            <StarDisplay count={Number(form.rating)} />
                            <div className="form-group">
                                <label htmlFor="rating">Rating (1-5)</label>
                                <select id="rating" name="rating" value={form.rating} onChange={setField}>
                                    <option value="1">1 Star</option>
                                    <option value="2">2 Stars</option>
                                    <option value="3">3 Stars</option>
                                    <option value="4">4 Stars</option>
                                    <option value="5">5 Stars</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className={btnClass("enrollStudent", "btn btn-green")} onClick={onEnrollStudent} disabled={isBusy}>Enroll</button>
                        <button type="button" className={btnClass("completeCourse", "btn btn-outline")} onClick={onCompleteCourse} disabled={isBusy}>Complete</button>
                        <button type="button" className={btnClass("rateCourse", "btn btn-amber")} onClick={onRateCourse} disabled={isBusy}>Rate</button>
                    </div>
                    <div className="actions-query">
                        <button type="button" className={btnClass("getEnrollmentCount", "btn btn-ghost")} onClick={onGetEnrollmentCount} disabled={isBusy}>Enrollment Count</button>
                    </div>
                </section>
            )}

            {/* Course Directory */}
            {activeTab === "directory" && (
                <section className="card">
                    <div className="card-header">
                        <span className="icon">{"\u{1F50D}"}</span>
                        <h2>Course Directory</h2>
                    </div>
                    <div className="actions-query">
                        <button type="button" className={btnClass("getCourse", "btn btn-sky")} onClick={onGetCourse} disabled={isBusy}>Get Course</button>
                        <button type="button" className={btnClass("listCourses", "btn btn-ghost")} onClick={onListCourses} disabled={isBusy}>List All Courses</button>
                    </div>
                </section>
            )}

            {/* Results */}
            <section className="results-card">
                <div className="results-header">
                    {"\u{1F4CB}"} Results
                </div>
                <div className={`results-body output-${status}`}>
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
