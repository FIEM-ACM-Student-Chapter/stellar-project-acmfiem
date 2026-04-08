import React, { useState, useRef } from "react";
import { checkConnection, postJob, applyJob, closeJob, hireApplicant, getJob, listJobs, getApplicationCount } from "../lib.js/stellar.js";

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

const truncateAddress = (addr) => addr && addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-6)}` : addr;

const JOB_TYPES = ["fulltime", "parttime", "contract", "remote"];

export default function App() {
    const [form, setForm] = useState({
        id: "job1",
        employer: "",
        title: "Senior Developer",
        description: "Looking for an experienced developer",
        location: "Remote",
        salaryMin: "80000",
        salaryMax: "120000",
        jobType: "fulltime",
        applicant: "",
        coverLetter: "I am excited to apply for this position.",
    });
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [walletState, setWalletState] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [activeTab, setActiveTab] = useState("post");
    const [confirmAction, setConfirmAction] = useState(null);
    const confirmTimer = useRef(null);

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
            setForm((prev) => ({ ...prev, employer: user.publicKey, applicant: user.publicKey }));
            return `Connected: ${user.publicKey}`;
        }
        setWalletState(null);
        return "Wallet: not connected";
    });

    const onPostJob = () => runAction("postJob", async () => postJob({
        id: form.id.trim(),
        employer: form.employer.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        salaryMin: form.salaryMin.trim(),
        salaryMax: form.salaryMax.trim(),
        jobType: form.jobType.trim(),
    }));

    const onApplyJob = () => runAction("applyJob", async () => applyJob({
        jobId: form.id.trim(),
        applicant: form.applicant.trim(),
        coverLetter: form.coverLetter.trim(),
    }));

    const handleCloseJob = () => {
        if (confirmAction === "closeJob") {
            clearTimeout(confirmTimer.current);
            setConfirmAction(null);
            runAction("closeJob", async () => closeJob({
                id: form.id.trim(),
                employer: form.employer.trim(),
            }));
        } else {
            setConfirmAction("closeJob");
            confirmTimer.current = setTimeout(() => setConfirmAction(null), 3000);
        }
    };

    const onHireApplicant = () => runAction("hireApplicant", async () => hireApplicant({
        jobId: form.id.trim(),
        employer: form.employer.trim(),
        applicant: form.applicant.trim(),
    }));

    const onGetJob = () => runAction("getJob", async () => getJob(form.id.trim()));
    const onListJobs = () => runAction("listJobs", async () => listJobs());
    const onGetAppCount = () => runAction("getAppCount", async () => {
        const count = await getApplicationCount(form.id.trim());
        return { jobId: form.id.trim(), applicationCount: count };
    });

    const statusClass = status === "success" ? "output-success" : status === "error" ? "output-error" : "output-idle";

    return (
        <main className="app">
            {/* Wallet Bar */}
            <nav className="wallet-bar">
                <div className="wallet-status">
                    <span className={`status-dot ${walletState ? "connected" : "disconnected"}`} />
                    <span className="wallet-text" id="walletState">
                        {walletState ? truncateAddress(walletState) : "Not Connected"}
                    </span>
                    <span className={`wallet-badge ${walletState ? "badge-connected" : "badge-disconnected"}`}>
                        {walletState ? "Connected" : "Not Connected"}
                    </span>
                </div>
                <button
                    type="button"
                    className={`connect-btn ${loadingAction === "connect" ? "btn-loading" : ""}`}
                    id="connectWallet"
                    onClick={onConnect}
                    disabled={isBusy}
                >
                    Connect Freighter
                </button>
            </nav>

            {/* Hero */}
            <section className="hero">
                <span className="hero-icon">{"\u{1F4BC}"}</span>
                <h1>Job Opportunity Portal</h1>
                <p className="subtitle">Post jobs, apply for positions, and manage hiring on-chain.</p>
            </section>

            {/* Tab Navigation */}
            <div className="tab-bar">
                <button
                    type="button"
                    className={`tab-btn ${activeTab === "post" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("post")}
                >
                    Post Job
                </button>
                <button
                    type="button"
                    className={`tab-btn ${activeTab === "applications" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("applications")}
                >
                    Applications
                </button>
                <button
                    type="button"
                    className={`tab-btn ${activeTab === "browse" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("browse")}
                >
                    Browse
                </button>
            </div>

            {/* Main Grid */}
            <div className="main-grid">
                {/* Post a Job Card */}
                {activeTab === "post" && (
                    <div className="card full-width">
                        <div className="card-header">
                            <span className="card-icon">{"\u{1F4DD}"}</span>
                            <h2>Post a Job</h2>
                        </div>

                        <div className="field-row">
                            <div className="field">
                                <label htmlFor="jobId">Job ID (Symbol)</label>
                                <input id="jobId" name="id" value={form.id} onChange={setField} />
                                <span className="helper">Unique identifier for the job listing</span>
                            </div>
                            <div className="field">
                                <label htmlFor="employer">Employer Address</label>
                                <input id="employer" name="employer" value={form.employer} onChange={setField} placeholder="G..." />
                                <span className="helper">Auto-filled on wallet connect</span>
                            </div>
                        </div>

                        <div className="field">
                            <label htmlFor="title">Job Title</label>
                            <input id="title" name="title" value={form.title} onChange={setField} />
                            <span className="helper">Position title (e.g., "Senior Developer")</span>
                        </div>

                        <div className="field">
                            <label htmlFor="description">Description</label>
                            <textarea id="description" name="description" rows="3" value={form.description} onChange={setField} />
                            <span className="helper">Describe the role and requirements</span>
                        </div>

                        <div className="field">
                            <label htmlFor="location">Location</label>
                            <input id="location" name="location" value={form.location} onChange={setField} />
                            <span className="helper">City, country, or "Remote"</span>
                        </div>

                        {/* Salary side-by-side */}
                        <div className="field-row">
                            <div className="field">
                                <label htmlFor="salaryMin">Salary Min (i128)</label>
                                <input id="salaryMin" name="salaryMin" value={form.salaryMin} onChange={setField} type="number" />
                                <span className="helper">Minimum annual salary</span>
                            </div>
                            <div className="field">
                                <label htmlFor="salaryMax">Salary Max (i128)</label>
                                <input id="salaryMax" name="salaryMax" value={form.salaryMax} onChange={setField} type="number" />
                                <span className="helper">Maximum annual salary</span>
                            </div>
                        </div>

                        {/* Job Type as styled tags/chips */}
                        <div className="field">
                            <label>Job Type</label>
                            <div className="job-type-tags">
                                {JOB_TYPES.map((jt) => (
                                    <span
                                        key={jt}
                                        className={`job-tag${form.jobType === jt ? " active" : ""}`}
                                        onClick={() => setForm((prev) => ({ ...prev, jobType: jt }))}
                                    >
                                        {jt}
                                    </span>
                                ))}
                            </div>
                            {/* Hidden select for form consistency */}
                            <select className="sr-only" id="jobType" name="jobType" value={form.jobType} onChange={setField}>
                                {JOB_TYPES.map((jt) => (
                                    <option key={jt} value={jt}>{jt}</option>
                                ))}
                            </select>
                        </div>

                        <div className="actions">
                            <button
                                type="button"
                                className={`btn-blue ${loadingAction === "postJob" ? "btn-loading" : ""}`}
                                onClick={onPostJob}
                                disabled={isBusy}
                            >
                                Post Job
                            </button>
                            <button
                                type="button"
                                className={`btn-red-outline ${loadingAction === "closeJob" ? "btn-loading" : ""} ${confirmAction === "closeJob" ? "btn-confirm" : ""}`}
                                onClick={handleCloseJob}
                                disabled={isBusy}
                            >
                                {confirmAction === "closeJob" ? "Confirm Close?" : "Close Job"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Applications Card */}
                {activeTab === "applications" && (
                    <div className="card full-width">
                        <div className="card-header">
                            <span className="card-icon">{"\u{1F4E8}"}</span>
                            <h2>Applications</h2>
                        </div>

                        <div className="field">
                            <label htmlFor="appJobId">Job ID</label>
                            <input id="appJobId" name="id" value={form.id} onChange={setField} />
                            <span className="helper">ID of the job to apply for or manage</span>
                        </div>

                        <div className="field">
                            <label htmlFor="applicant">Applicant Address</label>
                            <input id="applicant" name="applicant" value={form.applicant} onChange={setField} placeholder="G..." />
                            <span className="helper">Auto-filled on wallet connect</span>
                        </div>

                        <div className="field">
                            <label htmlFor="coverLetter">Cover Letter</label>
                            <textarea id="coverLetter" name="coverLetter" rows="3" value={form.coverLetter} onChange={setField} />
                            <span className="helper">Explain why you are a great fit</span>
                        </div>

                        <div className="actions">
                            <button
                                type="button"
                                className={`btn-blue ${loadingAction === "applyJob" ? "btn-loading" : ""}`}
                                onClick={onApplyJob}
                                disabled={isBusy}
                            >
                                Apply for Job
                            </button>
                            <button
                                type="button"
                                className={`btn-success ${loadingAction === "hireApplicant" ? "btn-loading" : ""}`}
                                onClick={onHireApplicant}
                                disabled={isBusy}
                            >
                                Hire Applicant
                            </button>
                        </div>
                    </div>
                )}

                {/* Browse / Job Board Queries */}
                {activeTab === "browse" && (
                    <div className="card full-width">
                        <div className="card-header">
                            <span className="card-icon">{"\u{1F50D}"}</span>
                            <h2>Job Board Queries</h2>
                        </div>

                        <div className="field">
                            <label htmlFor="browseJobId">Job ID</label>
                            <input id="browseJobId" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Enter a job ID to look up</span>
                        </div>

                        <div className="query-actions">
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "getJob" ? "btn-loading" : ""}`}
                                onClick={onGetJob}
                                disabled={isBusy}
                            >
                                Get Job
                            </button>
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "listJobs" ? "btn-loading" : ""}`}
                                onClick={onListJobs}
                                disabled={isBusy}
                            >
                                List Jobs
                            </button>
                            <button
                                type="button"
                                className={`btn-ghost ${loadingAction === "getAppCount" ? "btn-loading" : ""}`}
                                onClick={onGetAppCount}
                                disabled={isBusy}
                            >
                                Application Count
                            </button>
                        </div>
                    </div>
                )}

                {/* Results Feed */}
                <section className="results-feed">
                    <h2>{"\u{1F4E4}"} Results Feed</h2>
                    <pre id="output" className={statusClass}>
                        {output || "Connect your wallet and perform an action to see results here."}
                    </pre>
                </section>
            </div>
        </main>
    );
}
