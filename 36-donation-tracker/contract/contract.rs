#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Cause {
    pub organizer: Address,
    pub name: String,
    pub description: String,
    pub goal_amount: i128,
    pub raised_amount: i128,
    pub donor_count: u32,
    pub top_donation: i128,
    pub is_goal_met: bool,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DonationDataKey {
    CauseList,
    Cause(Symbol),
    CauseCount,
    DonorTotal(Symbol, Address),
    DonorTracked(Symbol, Address),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum DonationError {
    NameEmpty = 1,
    InvalidGoal = 2,
    CauseNotFound = 3,
    InvalidAmount = 4,
    MessageEmpty = 5,
}

#[contract]
pub struct DonationTrackerContract;

#[contractimpl]
impl DonationTrackerContract {
    fn cause_key(id: &Symbol) -> DonationDataKey {
        DonationDataKey::Cause(id.clone())
    }

    fn list_key() -> DonationDataKey {
        DonationDataKey::CauseList
    }

    fn count_key() -> DonationDataKey {
        DonationDataKey::CauseCount
    }

    fn donor_total_key(cause_id: &Symbol, donor: &Address) -> DonationDataKey {
        DonationDataKey::DonorTotal(cause_id.clone(), donor.clone())
    }

    fn donor_tracked_key(cause_id: &Symbol, donor: &Address) -> DonationDataKey {
        DonationDataKey::DonorTracked(cause_id.clone(), donor.clone())
    }

    fn load_ids(env: &Env) -> Vec<Symbol> {
        env.storage().instance().get(&Self::list_key()).unwrap_or(Vec::new(env))
    }

    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool {
        for current in ids.iter() {
            if current == id.clone() {
                return true;
            }
        }
        false
    }

    pub fn create_cause(
        env: Env,
        id: Symbol,
        organizer: Address,
        name: String,
        description: String,
        goal_amount: i128,
    ) {
        organizer.require_auth();

        if name.len() == 0 {
            panic_with_error!(&env, DonationError::NameEmpty);
        }
        if goal_amount <= 0 {
            panic_with_error!(&env, DonationError::InvalidGoal);
        }

        let cause = Cause {
            organizer,
            name,
            description,
            goal_amount,
            raised_amount: 0,
            donor_count: 0,
            top_donation: 0,
            is_goal_met: false,
            created_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&Self::cause_key(&id), &cause);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            env.storage().instance().set(&Self::list_key(), &ids);
            let count: u32 = env.storage().instance().get(&Self::count_key()).unwrap_or(0);
            env.storage().instance().set(&Self::count_key(), &(count + 1));
        }
    }

    pub fn donate_to_cause(
        env: Env,
        cause_id: Symbol,
        donor: Address,
        amount: i128,
        _message: String,
    ) {
        donor.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, DonationError::InvalidAmount);
        }

        let key = Self::cause_key(&cause_id);
        let maybe_cause: Option<Cause> = env.storage().instance().get(&key);
        if maybe_cause.is_none() {
            panic_with_error!(&env, DonationError::CauseNotFound);
        }
        let mut cause = maybe_cause.unwrap();

        cause.raised_amount += amount;
        if amount > cause.top_donation {
            cause.top_donation = amount;
        }
        if cause.raised_amount >= cause.goal_amount {
            cause.is_goal_met = true;
        }

        let tracked_key = Self::donor_tracked_key(&cause_id, &donor);
        let already_donated: bool = env.storage().instance().get(&tracked_key).unwrap_or(false);
        if !already_donated {
            cause.donor_count += 1;
            env.storage().instance().set(&tracked_key, &true);
        }

        env.storage().instance().set(&key, &cause);

        let dt_key = Self::donor_total_key(&cause_id, &donor);
        let prev: i128 = env.storage().instance().get(&dt_key).unwrap_or(0);
        env.storage().instance().set(&dt_key, &(prev + amount));
    }

    pub fn get_cause(env: Env, id: Symbol) -> Option<Cause> {
        env.storage().instance().get(&Self::cause_key(&id))
    }

    pub fn list_causes(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_donor_total(env: Env, cause_id: Symbol, donor: Address) -> i128 {
        env.storage().instance().get(&Self::donor_total_key(&cause_id, &donor)).unwrap_or(0)
    }

    pub fn get_top_donation(env: Env, cause_id: Symbol) -> i128 {
        let maybe_cause: Option<Cause> = env.storage().instance().get(&Self::cause_key(&cause_id));
        if let Some(cause) = maybe_cause {
            cause.top_donation
        } else {
            0
        }
    }

    pub fn get_cause_count(env: Env) -> u32 {
        env.storage().instance().get(&Self::count_key()).unwrap_or(0)
    }
}
