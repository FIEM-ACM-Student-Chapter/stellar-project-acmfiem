import { isAllowed, requestAccess, signTransaction } from "@stellar/freighter-api";
import { Account, Address, Contract, Networks, rpc, TransactionBuilder, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";

export const CONTRACT_ID = "";
export const DEMO_ADDR = "";
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

const server = new rpc.Server(RPC_URL);

const toSymbol = (value) => xdr.ScVal.scvSymbol(String(value));
const toI128 = (value) => nativeToScVal(BigInt(value || 0), { type: "i128" });

const requireConfig = () => {
    if (!CONTRACT_ID) throw new Error("Set CONTRACT_ID in lib.js/stellar.js");
    if (!DEMO_ADDR) throw new Error("Set DEMO_ADDR in lib.js/stellar.js");
};

export const checkConnection = async () => {
    try {
        const allowed = await isAllowed();
        if (!allowed) return null;
        const result = await requestAccess();
        if (!result) return null;
        const address = (result && typeof result === "object" && result.address) ? result.address : result;
        if (!address || typeof address !== "string") return null;
        return { publicKey: address };
    } catch {
        return null;
    }
};

const waitForTx = async (hash, attempts = 0) => {
    const tx = await server.getTransaction(hash);
    if (tx.status === "SUCCESS") return tx;
    if (tx.status === "FAILED") throw new Error("Transaction failed");
    if (attempts > 30) throw new Error("Timed out waiting for transaction confirmation");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return waitForTx(hash, attempts + 1);
};

const invokeWrite = async (method, args = []) => {
    if (!CONTRACT_ID) throw new Error("Set CONTRACT_ID in lib.js/stellar.js");

    const user = await checkConnection();
    if (!user) throw new Error("Freighter wallet is not connected");

    const account = await server.getAccount(user.publicKey);
    let tx = new TransactionBuilder(account, {
        fee: "10000",
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(new Contract(CONTRACT_ID).call(method, ...args))
        .setTimeout(30)
        .build();

    tx = await server.prepareTransaction(tx);

    const signed = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
    if (!signed || signed.error) throw new Error(signed?.error || "Transaction signing failed");

    const signedTxXdr = typeof signed === "string" ? signed : signed.signedTxXdr;
    const sent = await server.sendTransaction(TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE));

    if (sent.status === "ERROR") {
        throw new Error(sent.errorResultXdr || "Transaction rejected by network");
    }

    return waitForTx(sent.hash);
};

const invokeRead = async (method, args = []) => {
    requireConfig();

    const tx = new TransactionBuilder(new Account(DEMO_ADDR, "0"), {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(new Contract(CONTRACT_ID).call(method, ...args))
        .setTimeout(0)
        .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(sim)) {
        return scValToNative(sim.result.retval);
    }

    throw new Error(sim.error || `Read simulation failed: ${method}`);
};

export const postJob = async (payload) => {
    if (!payload?.id) throw new Error("id is required");
    if (!payload?.employer) throw new Error("employer address is required");

    return invokeWrite("post_job", [
        toSymbol(payload.id),
        new Address(payload.employer).toScVal(),
        nativeToScVal(payload.title || ""),
        nativeToScVal(payload.description || ""),
        nativeToScVal(payload.location || ""),
        toI128(payload.salaryMin),
        toI128(payload.salaryMax),
        toSymbol(payload.jobType || "fulltime"),
    ]);
};

export const applyJob = async (payload) => {
    if (!payload?.jobId) throw new Error("jobId is required");
    if (!payload?.applicant) throw new Error("applicant address is required");

    return invokeWrite("apply_job", [
        toSymbol(payload.jobId),
        new Address(payload.applicant).toScVal(),
        nativeToScVal(payload.coverLetter || ""),
    ]);
};

export const closeJob = async (payload) => {
    if (!payload?.id) throw new Error("id is required");
    if (!payload?.employer) throw new Error("employer address is required");

    return invokeWrite("close_job", [
        toSymbol(payload.id),
        new Address(payload.employer).toScVal(),
    ]);
};

export const hireApplicant = async (payload) => {
    if (!payload?.jobId) throw new Error("jobId is required");
    if (!payload?.employer) throw new Error("employer address is required");
    if (!payload?.applicant) throw new Error("applicant address is required");

    return invokeWrite("hire_applicant", [
        toSymbol(payload.jobId),
        new Address(payload.employer).toScVal(),
        new Address(payload.applicant).toScVal(),
    ]);
};

export const getJob = async (id) => {
    if (!id) throw new Error("id is required");
    return invokeRead("get_job", [toSymbol(id)]);
};

export const listJobs = async () => {
    return invokeRead("list_jobs", []);
};

export const getApplicationCount = async (jobId) => {
    if (!jobId) throw new Error("jobId is required");
    return invokeRead("get_application_count", [toSymbol(jobId)]);
};
