#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Bounty {
    pub creator: Address,
    pub worker: Address,
    pub title: String,
    pub description: String,
    pub reward: i128,
    pub status: Symbol,
    pub assigned: bool,
    pub created_at: u64,
    pub submitted_at: u64,
    pub approved_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum BountyDataKey {
    IdList,
    Bounty(Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum BountyError {
    InvalidTitle = 1,
    InvalidReward = 2,
    InvalidTimestamp = 3,
    NotFound = 4,
    Unauthorized = 5,
    AlreadyExists = 6,
    NotAssigned = 7,
    NotSubmitted = 8,
    Closed = 9,
}

#[contract]
pub struct BountyBoardContract;

#[contractimpl]
impl BountyBoardContract {
    fn ids_key() -> BountyDataKey {
        BountyDataKey::IdList
    }

    fn bounty_key(id: &Symbol) -> BountyDataKey {
        BountyDataKey::Bounty(id.clone())
    }

    fn load_ids(env: &Env) -> Vec<Symbol> {
        env.storage().instance().get(&Self::ids_key()).unwrap_or(Vec::new(env))
    }

    fn save_ids(env: &Env, ids: &Vec<Symbol>) {
        env.storage().instance().set(&Self::ids_key(), ids);
    }

    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool {
        for current in ids.iter() {
            if current == id.clone() {
                return true;
            }
        }
        false
    }

    pub fn create_bounty(
        env: Env,
        id: Symbol,
        creator: Address,
        title: String,
        description: String,
        reward: i128,
        created_at: u64,
    ) {
        creator.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, BountyError::InvalidTitle);
        }
        if reward <= 0 {
            panic_with_error!(&env, BountyError::InvalidReward);
        }
        if created_at == 0 {
            panic_with_error!(&env, BountyError::InvalidTimestamp);
        }

        let key = Self::bounty_key(&id);
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, BountyError::AlreadyExists);
        }

        let bounty = Bounty {
            creator: creator.clone(),
            worker: creator,
            title,
            description,
            reward,
            status: Symbol::new(&env, "open"),
            assigned: false,
            created_at,
            submitted_at: 0,
            approved_at: 0,
        };

        env.storage().instance().set(&key, &bounty);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn assign_bounty(env: Env, id: Symbol, creator: Address, worker: Address) {
        creator.require_auth();

        let key = Self::bounty_key(&id);
        let maybe_bounty: Option<Bounty> = env.storage().instance().get(&key);

        if let Some(mut bounty) = maybe_bounty {
            if bounty.creator != creator {
                panic_with_error!(&env, BountyError::Unauthorized);
            }
            if bounty.status == Symbol::new(&env, "closed") {
                panic_with_error!(&env, BountyError::Closed);
            }

            bounty.worker = worker;
            bounty.assigned = true;
            bounty.status = Symbol::new(&env, "assigned");
            env.storage().instance().set(&key, &bounty);
        } else {
            panic_with_error!(&env, BountyError::NotFound);
        }
    }

    pub fn submit_bounty(env: Env, id: Symbol, worker: Address) {
        worker.require_auth();

        let key = Self::bounty_key(&id);
        let maybe_bounty: Option<Bounty> = env.storage().instance().get(&key);

        if let Some(mut bounty) = maybe_bounty {
            if !bounty.assigned {
                panic_with_error!(&env, BountyError::NotAssigned);
            }
            if bounty.worker != worker {
                panic_with_error!(&env, BountyError::Unauthorized);
            }
            if bounty.status != Symbol::new(&env, "assigned") {
                panic_with_error!(&env, BountyError::NotAssigned);
            }

            bounty.status = Symbol::new(&env, "submitted");
            bounty.submitted_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &bounty);
        } else {
            panic_with_error!(&env, BountyError::NotFound);
        }
    }

    pub fn approve_bounty(env: Env, id: Symbol, creator: Address) {
        creator.require_auth();

        let key = Self::bounty_key(&id);
        let maybe_bounty: Option<Bounty> = env.storage().instance().get(&key);

        if let Some(mut bounty) = maybe_bounty {
            if bounty.creator != creator {
                panic_with_error!(&env, BountyError::Unauthorized);
            }
            if bounty.status != Symbol::new(&env, "submitted") {
                panic_with_error!(&env, BountyError::NotSubmitted);
            }

            bounty.status = Symbol::new(&env, "approved");
            bounty.approved_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &bounty);
        } else {
            panic_with_error!(&env, BountyError::NotFound);
        }
    }

    pub fn close_bounty(env: Env, id: Symbol, creator: Address) {
        creator.require_auth();

        let key = Self::bounty_key(&id);
        let maybe_bounty: Option<Bounty> = env.storage().instance().get(&key);

        if let Some(mut bounty) = maybe_bounty {
            if bounty.creator != creator {
                panic_with_error!(&env, BountyError::Unauthorized);
            }
            if bounty.status == Symbol::new(&env, "closed") {
                panic_with_error!(&env, BountyError::Closed);
            }

            bounty.status = Symbol::new(&env, "closed");
            env.storage().instance().set(&key, &bounty);
        } else {
            panic_with_error!(&env, BountyError::NotFound);
        }
    }

    pub fn get_bounty(env: Env, id: Symbol) -> Option<Bounty> {
        env.storage().instance().get(&Self::bounty_key(&id))
    }

    pub fn list_bounties(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }
}

