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
const toBool = (value) => xdr.ScVal.scvBool(Boolean(value));

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

export const createProposal = async (payload) => {
    if (!payload?.id) throw new Error("id is required");
    if (!payload?.proposer) throw new Error("proposer address is required");

    return invokeWrite("create_proposal", [
        toSymbol(payload.id),
        new Address(payload.proposer).toScVal(),
        nativeToScVal(payload.title || ""),
        nativeToScVal(payload.description || ""),
        toSymbol(payload.category || "general"),
        toU64(payload.votingPeriod),
    ]);
};

export const castVote = async (payload) => {
    if (!payload?.proposalId) throw new Error("proposalId is required");
    if (!payload?.voter) throw new Error("voter address is required");

    return invokeWrite("cast_vote", [
        toSymbol(payload.proposalId),
        new Address(payload.voter).toScVal(),
        toI128(payload.votePower),
        toBool(payload.inFavor),
    ]);
};

export const executeProposal = async (payload) => {
    if (!payload?.id) throw new Error("id is required");
    if (!payload?.executor) throw new Error("executor address is required");

    return invokeWrite("execute_proposal", [
        toSymbol(payload.id),
        new Address(payload.executor).toScVal(),
    ]);
};

export const vetoProposal = async (payload) => {
    if (!payload?.id) throw new Error("id is required");
    if (!payload?.vetoer) throw new Error("vetoer address is required");

    return invokeWrite("veto_proposal", [
        toSymbol(payload.id),
        new Address(payload.vetoer).toScVal(),
    ]);
};

export const getProposal = async (id) => {
    if (!id) throw new Error("id is required");
    return invokeRead("get_proposal", [toSymbol(id)]);
};

export const listProposals = async () => {
    return invokeRead("list_proposals", []);
};

export const hasVoted = async (proposalId, voter) => {
    if (!proposalId) throw new Error("proposalId is required");
    if (!voter) throw new Error("voter address is required");
    return invokeRead("has_voted", [
        toSymbol(proposalId),
        new Address(voter).toScVal(),
    ]);
};

export const getProposalCount = async () => {
    return invokeRead("get_proposal_count", []);
};
