import { isAllowed, requestAccess, signTransaction } from "@stellar/freighter-api";
import { Account, Address, Contract, Networks, rpc, TransactionBuilder, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";

export const CONTRACT_ID = "";
export const DEMO_ADDR = "";
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

const server = new rpc.Server(RPC_URL);

const toSymbol = (value) => xdr.ScVal.scvSymbol(String(value));
const toI128 = (value) => nativeToScVal(BigInt(value || 0), { type: "i128" });
const toU64 = (value) => nativeToScVal(BigInt(value || 0), { type: "u64" });
const toU32 = (value) => nativeToScVal(Number(value || 0), { type: "u32" });

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

export const createSession = async (payload) => {
    if (!payload?.id) throw new Error("id is required");
    if (!payload?.tutor) throw new Error("tutor address is required");

    return invokeWrite("create_session", [
        toSymbol(payload.id),
        new Address(payload.tutor).toScVal(),
        nativeToScVal(payload.subject || ""),
        nativeToScVal(payload.description || ""),
        toU64(payload.sessionDate),
        toU32(payload.durationMins),
        toI128(payload.price),
        toU32(payload.maxAttendees),
    ]);
};

export const bookSession = async (sessionId, student, paymentAmount) => {
    if (!sessionId) throw new Error("sessionId is required");
    if (!student) throw new Error("student address is required");

    return invokeWrite("book_session", [
        toSymbol(sessionId),
        new Address(student).toScVal(),
        toI128(paymentAmount),
    ]);
};

export const startSession = async (id, tutor) => {
    if (!id) throw new Error("id is required");
    if (!tutor) throw new Error("tutor address is required");
    return invokeWrite("start_session", [
        toSymbol(id),
        new Address(tutor).toScVal(),
    ]);
};

export const completeSession = async (id, tutor) => {
    if (!id) throw new Error("id is required");
    if (!tutor) throw new Error("tutor address is required");
    return invokeWrite("complete_session", [
        toSymbol(id),
        new Address(tutor).toScVal(),
    ]);
};

export const cancelSession = async (id, tutor) => {
    if (!id) throw new Error("id is required");
    if (!tutor) throw new Error("tutor address is required");
    return invokeWrite("cancel_session", [
        toSymbol(id),
        new Address(tutor).toScVal(),
    ]);
};

export const rateSession = async (id, student, rating) => {
    if (!id) throw new Error("id is required");
    if (!student) throw new Error("student address is required");
    return invokeWrite("rate_session", [
        toSymbol(id),
        new Address(student).toScVal(),
        toU32(rating),
    ]);
};

export const getSession = async (id) => {
    if (!id) throw new Error("id is required");
    return invokeRead("get_session", [toSymbol(id)]);
};

export const listSessions = async () => {
    return invokeRead("list_sessions", []);
};
