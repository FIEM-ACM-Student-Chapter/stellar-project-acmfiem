#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Proposal {
    pub proposer: Address,
    pub title: String,
    pub description: String,
    pub category: Symbol,
    pub votes_for: i128,
    pub votes_against: i128,
    pub voter_count: u32,
    pub status: Symbol,
    pub created_at: u64,
    pub ends_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IdList,
    Proposal(Symbol),
    Count,
    Voted(Symbol, Address),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    NotFound = 1,
    NotAuthorized = 2,
    InvalidTitle = 3,
    AlreadyVoted = 4,
    VotingEnded = 5,
    NotActive = 6,
    InvalidPower = 7,
    CannotExecute = 8,
}

#[contract]
pub struct DaoVotingContract;

#[contractimpl]
impl DaoVotingContract {
    fn load_ids(env: &Env) -> Vec<Symbol> {
        env.storage().instance().get(&DataKey::IdList).unwrap_or(Vec::new(env))
    }

    fn save_ids(env: &Env, ids: &Vec<Symbol>) {
        env.storage().instance().set(&DataKey::IdList, ids);
    }

    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool {
        for current in ids.iter() {
            if current == id.clone() {
                return true;
            }
        }
        false
    }

    pub fn create_proposal(
        env: Env,
        id: Symbol,
        proposer: Address,
        title: String,
        description: String,
        category: Symbol,
        voting_period: u64,
    ) {
        proposer.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, ContractError::InvalidTitle);
        }

        let now = env.ledger().timestamp();
        let active = Symbol::new(&env, "active");

        let proposal = Proposal {
            proposer,
            title,
            description,
            category,
            votes_for: 0,
            votes_against: 0,
            voter_count: 0,
            status: active,
            created_at: now,
            ends_at: now + voting_period,
        };

        let key = DataKey::Proposal(id.clone());
        let exists = env.storage().instance().has(&key);
        env.storage().instance().set(&key, &proposal);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
            if !exists {
                let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
                env.storage().instance().set(&DataKey::Count, &(count + 1));
            }
        }
    }

    pub fn cast_vote(
        env: Env,
        proposal_id: Symbol,
        voter: Address,
        vote_power: i128,
        in_favor: bool,
    ) {
        voter.require_auth();

        if vote_power <= 0 {
            panic_with_error!(&env, ContractError::InvalidPower);
        }

        let key = DataKey::Proposal(proposal_id.clone());
        let mut proposal: Proposal = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotFound));

        let active = Symbol::new(&env, "active");
        if proposal.status != active {
            panic_with_error!(&env, ContractError::NotActive);
        }

        let now = env.ledger().timestamp();
        if now > proposal.ends_at {
            panic_with_error!(&env, ContractError::VotingEnded);
        }

        let vote_key = DataKey::Voted(proposal_id.clone(), voter.clone());
        if env.storage().instance().has(&vote_key) {
            panic_with_error!(&env, ContractError::AlreadyVoted);
        }

        if in_favor {
            proposal.votes_for += vote_power;
        } else {
            proposal.votes_against += vote_power;
        }
        proposal.voter_count += 1;

        env.storage().instance().set(&vote_key, &true);
        env.storage().instance().set(&key, &proposal);
    }

    pub fn execute_proposal(env: Env, id: Symbol, executor: Address) {
        executor.require_auth();

        let key = DataKey::Proposal(id.clone());
        let mut proposal: Proposal = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotFound));

        let active = Symbol::new(&env, "active");
        if proposal.status != active {
            panic_with_error!(&env, ContractError::NotActive);
        }

        let now = env.ledger().timestamp();
        if now <= proposal.ends_at {
            panic_with_error!(&env, ContractError::CannotExecute);
        }

        if proposal.votes_for > proposal.votes_against {
            proposal.status = Symbol::new(&env, "executed");
        } else {
            proposal.status = Symbol::new(&env, "rejected");
        }

        env.storage().instance().set(&key, &proposal);
    }

    pub fn veto_proposal(env: Env, id: Symbol, vetoer: Address) {
        vetoer.require_auth();

        let key = DataKey::Proposal(id.clone());
        let mut proposal: Proposal = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotFound));

        proposal.status = Symbol::new(&env, "vetoed");
        env.storage().instance().set(&key, &proposal);
    }

    pub fn get_proposal(env: Env, id: Symbol) -> Option<Proposal> {
        env.storage().instance().get(&DataKey::Proposal(id))
    }

    pub fn list_proposals(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn has_voted(env: Env, proposal_id: Symbol, voter: Address) -> bool {
        let vote_key = DataKey::Voted(proposal_id, voter);
        env.storage().instance().has(&vote_key)
    }

    pub fn get_proposal_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }
}
