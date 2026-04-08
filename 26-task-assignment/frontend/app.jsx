import React, { useState, useRef } from "react";
import { checkConnection, createTask, assignTask, startTask, completeTask, reviewTask, getTask, listTasks, getTaskCount } from "../lib.js/stellar.js";

const nowTs = () => Math.floor(Date.now() / 1000);

const toOutput = (value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
};

export default function App() {
    const [form, setForm] = useState({
        id: "task1",
        creator: "",
        assignee: "",
        reviewer: "",
        title: "Implement login page",
        description: "Build the login UI with form validation",
        priority: "3",
        dueDate: String(nowTs() + 86400 * 7),
        estimatedHours: "8",
        actualHours: "6",
        approved: true,
    });
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [walletState, setWalletState] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [taskCount, setTaskCount] = useState("-");
    const [activeTab, setActiveTab] = useState("create");
    const confirmTimers = useRef({});
    const [confirmingBtn, setConfirmingBtn] = useState(null);

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
            setWalletState(user.publicKey);
            setForm((prev) => ({
                ...prev,
                creator: user.publicKey,
                assignee: prev.assignee || user.publicKey,
                reviewer: prev.reviewer || user.publicKey,
            }));
            return `Connected: ${user.publicKey}`;
        }
        setWalletState(null);
        return "Wallet: not connected";
    });

    const onCreateTask = () => runAction("createTask", async () =>
        createTask({
            id: form.id.trim(),
            creator: form.creator.trim(),
            title: form.title.trim(),
            description: form.description.trim(),
            priority: form.priority.trim(),
            dueDate: form.dueDate.trim(),
            estimatedHours: form.estimatedHours.trim(),
        })
    );

    const onAssignTask = () => runAction("assignTask", async () =>
        assignTask({
            id: form.id.trim(),
            creator: form.creator.trim(),
            assignee: form.assignee.trim(),
        })
    );

    const onStartTask = () => runAction("startTask", async () =>
        startTask({
            id: form.id.trim(),
            assignee: form.assignee.trim(),
        })
    );

    const onCompleteTask = () => runAction("completeTask", async () =>
        completeTask({
            id: form.id.trim(),
            assignee: form.assignee.trim(),
            actualHours: form.actualHours.trim(),
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

    const onReviewTask = () => runAction("reviewTask", async () =>
        reviewTask({
            id: form.id.trim(),
            reviewer: form.reviewer.trim(),
            approved: form.approved,
        })
    );

    const onGetTask = () => runAction("getTask", async () => getTask(form.id.trim()));

    const onListTasks = () => runAction("listTasks", async () => listTasks());

    const onGetCount = () => runAction("getCount", async () => {
        const value = await getTaskCount();
        setTaskCount(String(value));
        return { taskCount: value };
    });

    const truncAddr = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
    const tabs = [
        { key: "create", label: "Create Task" },
        { key: "pipeline", label: "Pipeline" },
        { key: "board", label: "Board" },
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

            {/* Hero */}
            <section className="hero">
                <div className="hero-top">
                    <span className="hero-icon">&#128203;</span>
                    <span className="kicker">Stellar Soroban Project 26</span>
                </div>
                <h1>Task Assignment System</h1>
                <p className="subtitle">
                    Create tasks, assign to team members, track progress through review and approval on the blockchain.
                </p>
                <span className="task-count-badge">Total Tasks: {taskCount}</span>
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

            {/* Tab: Create Task */}
            {activeTab === "create" && (
                <section className="card">
                    <h2>Create Task</h2>
                    <div className="form-grid">
                        <div className="field">
                            <label htmlFor="id">Task ID</label>
                            <input id="id" name="id" value={form.id} onChange={setField} />
                            <span className="helper">Unique task identifier</span>
                        </div>
                        <div className="field">
                            <label htmlFor="creator">Creator Address</label>
                            <input id="creator" name="creator" value={form.creator} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key starting with G</span>
                        </div>
                        <div className="field">
                            <label htmlFor="priority">Priority (0-5)</label>
                            <input id="priority" name="priority" value={form.priority} onChange={setField} type="number" />
                        </div>
                        <div className="field span-2">
                            <label htmlFor="title">Title</label>
                            <input id="title" name="title" value={form.title} onChange={setField} />
                        </div>
                        <div className="field">
                            <label htmlFor="estimatedHours">Estimated Hours</label>
                            <input id="estimatedHours" name="estimatedHours" value={form.estimatedHours} onChange={setField} type="number" />
                        </div>
                        <div className="field full">
                            <label htmlFor="description">Description</label>
                            <input id="description" name="description" value={form.description} onChange={setField} />
                        </div>
                        <div className="field">
                            <label htmlFor="dueDate">Due Date (u64)</label>
                            <input id="dueDate" name="dueDate" value={form.dueDate} onChange={setField} type="number" />
                            <span className="helper">Unix timestamp in seconds</span>
                        </div>
                        <div className="field">
                            <label htmlFor="assignee">Assignee Address</label>
                            <input id="assignee" name="assignee" value={form.assignee} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key starting with G</span>
                        </div>
                        <div className="field">
                            <label htmlFor="reviewer">Reviewer Address</label>
                            <input id="reviewer" name="reviewer" value={form.reviewer} onChange={setField} placeholder="G..." />
                            <span className="helper">Stellar public key starting with G</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className={`btn-create ${loadingAction === "createTask" ? "btn-loading" : ""}`}
                        onClick={onCreateTask}
                        disabled={isBusy}
                    >
                        Create Task
                    </button>
                </section>
            )}

            {/* Tab: Pipeline */}
            {activeTab === "pipeline" && (
                <section className="card">
                    <h2>Task Pipeline</h2>
                    <div className="field" style={{ marginBottom: "0.8rem" }}>
                        <label htmlFor="actualHours">Actual Hours (for complete)</label>
                        <input id="actualHours" name="actualHours" value={form.actualHours} onChange={setField} type="number" style={{ maxWidth: "200px" }} />
                    </div>
                    <div className="checkbox-field" style={{ marginBottom: "1rem" }}>
                        <input id="approved" name="approved" type="checkbox" checked={form.approved} onChange={setField} />
                        <label htmlFor="approved">Approved (for review)</label>
                    </div>
                    <div className="pipeline">
                        <div className="pipeline-step step-assign">
                            <div className="step-number">1</div>
                            <span className="step-label">Assign</span>
                            <span className="badge badge-blue">Backlog</span>
                            <button
                                type="button"
                                onClick={onAssignTask}
                                disabled={isBusy}
                                className={loadingAction === "assignTask" ? "btn-loading" : ""}
                                style={{ marginTop: "0.6rem" }}
                            >
                                Assign Task
                            </button>
                        </div>
                        <div className="pipeline-step step-start">
                            <div className="step-number">2</div>
                            <span className="step-label">Start</span>
                            <span className="badge badge-amber">In Progress</span>
                            <button
                                type="button"
                                onClick={onStartTask}
                                disabled={isBusy}
                                className={loadingAction === "startTask" ? "btn-loading" : ""}
                                style={{ marginTop: "0.6rem" }}
                            >
                                Start Task
                            </button>
                        </div>
                        <div className="pipeline-step step-complete">
                            <div className="step-number">3</div>
                            <span className="step-label">Complete</span>
                            <span className="badge badge-green">Done</span>
                            <button
                                type="button"
                                onClick={onCompleteTask}
                                disabled={isBusy}
                                className={loadingAction === "completeTask" ? "btn-loading" : ""}
                                style={{ marginTop: "0.6rem" }}
                            >
                                Complete
                            </button>
                        </div>
                        <div className="pipeline-step step-review">
                            <div className="step-number">4</div>
                            <span className="step-label">Review</span>
                            <span className="badge badge-purple">Review</span>
                            <button
                                type="button"
                                onClick={onReviewTask}
                                disabled={isBusy}
                                className={loadingAction === "reviewTask" ? "btn-loading" : ""}
                                style={{ marginTop: "0.6rem" }}
                            >
                                Review
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {/* Tab: Board */}
            {activeTab === "board" && (
                <section className="card">
                    <h2>Task Board</h2>
                    <div className="query-strip">
                        <button
                            type="button"
                            className={`btn-ghost ${loadingAction === "getTask" ? "btn-loading" : ""}`}
                            onClick={onGetTask}
                            disabled={isBusy}
                        >
                            Get Task
                        </button>
                        <button
                            type="button"
                            className={`btn-ghost ${loadingAction === "listTasks" ? "btn-loading" : ""}`}
                            onClick={onListTasks}
                            disabled={isBusy}
                        >
                            List Tasks
                        </button>
                        <button
                            type="button"
                            className={`btn-ghost ${loadingAction === "getCount" ? "btn-loading" : ""}`}
                            onClick={onGetCount}
                            disabled={isBusy}
                        >
                            Get Count
                        </button>
                    </div>
                </section>
            )}

            {/* Task Details / Output */}
            <section className="card task-output">
                <h2>Task Details</h2>
                <pre id="output" className={`status-${status}`}>
                    {output || "Create or query tasks to see details here."}
                </pre>
            </section>
        </main>
    );
}
