#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, Map,
    String, Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Poll {
    pub creator: Address,
    pub question: String,
    pub options_count: u32,
    pub total_votes: u32,
    pub is_closed: bool,
    pub created_at: u64,
    pub end_time: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    PollList,
    Poll(Symbol),
    VoteRecord(Symbol, Address),
    VoteTally(Symbol, u32),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VotingError {
    PollNotFound = 1,
    PollAlreadyExists = 2,
    PollClosed = 3,
    AlreadyVoted = 4,
    InvalidOption = 5,
    NotCreator = 6,
    InvalidQuestion = 7,
    InvalidOptionsCount = 8,
}

#[contract]
pub struct VotingPollingContract;

#[contractimpl]
impl VotingPollingContract {
    fn load_ids(env: &Env) -> Vec<Symbol> {
        env.storage()
            .instance()
            .get(&DataKey::PollList)
            .unwrap_or(Vec::new(env))
    }

    fn save_ids(env: &Env, ids: &Vec<Symbol>) {
        env.storage().instance().set(&DataKey::PollList, ids);
    }

    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool {
        for current in ids.iter() {
            if current == id.clone() {
                return true;
            }
        }
        false
    }

    pub fn create_poll(
        env: Env,
        id: Symbol,
        creator: Address,
        question: String,
        options_count: u32,
        end_time: u64,
    ) {
        creator.require_auth();

        if question.len() == 0 {
            panic_with_error!(env, VotingError::InvalidQuestion);
        }
        if options_count == 0 {
            panic_with_error!(env, VotingError::InvalidOptionsCount);
        }

        let key = DataKey::Poll(id.clone());
        if env.storage().instance().has(&key) {
            panic_with_error!(env, VotingError::PollAlreadyExists);
        }

        let poll = Poll {
            creator,
            question,
            options_count,
            total_votes: 0,
            is_closed: false,
            created_at: env.ledger().timestamp(),
            end_time,
        };

        env.storage().instance().set(&key, &poll);

        let mut i: u32 = 0;
        while i < options_count {
            env.storage()
                .instance()
                .set(&DataKey::VoteTally(id.clone(), i), &0u32);
            i += 1;
        }

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn cast_vote(env: Env, poll_id: Symbol, voter: Address, option_index: u32) {
        voter.require_auth();

        let key = DataKey::Poll(poll_id.clone());
        let mut poll: Poll = env
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, VotingError::PollNotFound));

        if poll.is_closed {
            panic_with_error!(env, VotingError::PollClosed);
        }
        if option_index >= poll.options_count {
            panic_with_error!(env, VotingError::InvalidOption);
        }

        let vote_key = DataKey::VoteRecord(poll_id.clone(), voter);
        if env.storage().instance().has(&vote_key) {
            panic_with_error!(env, VotingError::AlreadyVoted);
        }

        env.storage().instance().set(&vote_key, &option_index);

        let tally_key = DataKey::VoteTally(poll_id.clone(), option_index);
        let count: u32 = env.storage().instance().get(&tally_key).unwrap_or(0);
        env.storage().instance().set(&tally_key, &(count + 1));

        poll.total_votes += 1;
        env.storage().instance().set(&key, &poll);
    }

    pub fn close_poll(env: Env, poll_id: Symbol, creator: Address) {
        creator.require_auth();

        let key = DataKey::Poll(poll_id.clone());
        let mut poll: Poll = env
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, VotingError::PollNotFound));

        if poll.creator != creator {
            panic_with_error!(env, VotingError::NotCreator);
        }

        poll.is_closed = true;
        env.storage().instance().set(&key, &poll);
    }

    pub fn get_results(env: Env, poll_id: Symbol) -> Map<u32, u32> {
        let key = DataKey::Poll(poll_id.clone());
        let poll: Poll = env
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, VotingError::PollNotFound));

        let mut results = Map::new(&env);
        let mut i: u32 = 0;
        while i < poll.options_count {
            let tally_key = DataKey::VoteTally(poll_id.clone(), i);
            let count: u32 = env.storage().instance().get(&tally_key).unwrap_or(0);
            results.set(i, count);
            i += 1;
        }
        results
    }

    pub fn get_poll(env: Env, id: Symbol) -> Option<Poll> {
        env.storage().instance().get(&DataKey::Poll(id))
    }

    pub fn list_polls(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn has_voted(env: Env, poll_id: Symbol, voter: Address) -> bool {
        env.storage()
            .instance()
            .has(&DataKey::VoteRecord(poll_id, voter))
    }
}
