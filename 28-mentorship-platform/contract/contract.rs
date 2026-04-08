#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Mentor {
    pub mentor: Address,
    pub name: String,
    pub expertise: Symbol,
    pub bio: String,
    pub hourly_rate: i128,
    pub max_mentees: u32,
    pub current_mentees: u32,
    pub total_sessions: u32,
    pub total_hours: u32,
    pub total_rating: u32,
    pub rating_count: u32,
    pub is_active: bool,
    pub registered_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IdList,
    Mentor(Symbol),
    Count,
    MenteeOf(Symbol, Address),
    PendingMentee(Symbol, Address),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    NotFound = 1,
    MentorFull = 2,
    NotAuthorized = 3,
    InvalidRating = 4,
    AlreadyRequested = 5,
    NotMentee = 6,
    InvalidName = 7,
    InvalidRate = 8,
}

#[contract]
pub struct MentorshipPlatformContract;

#[contractimpl]
impl MentorshipPlatformContract {
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

    pub fn register_mentor(
        env: Env,
        id: Symbol,
        mentor: Address,
        name: String,
        expertise: Symbol,
        bio: String,
        hourly_rate: i128,
        max_mentees: u32,
    ) {
        mentor.require_auth();

        if name.len() == 0 {
            panic_with_error!(&env, ContractError::InvalidName);
        }
        if hourly_rate < 0 {
            panic_with_error!(&env, ContractError::InvalidRate);
        }

        let now = env.ledger().timestamp();

        let record = Mentor {
            mentor,
            name,
            expertise,
            bio,
            hourly_rate,
            max_mentees,
            current_mentees: 0,
            total_sessions: 0,
            total_hours: 0,
            total_rating: 0,
            rating_count: 0,
            is_active: true,
            registered_at: now,
        };

        let key = DataKey::Mentor(id.clone());
        let exists = env.storage().instance().has(&key);
        env.storage().instance().set(&key, &record);

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

    pub fn request_mentorship(env: Env, mentor_id: Symbol, mentee: Address, message: String) {
        mentee.require_auth();
        let _ = message;

        let key = DataKey::Mentor(mentor_id.clone());
        let record: Mentor = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotFound));

        if record.current_mentees >= record.max_mentees {
            panic_with_error!(&env, ContractError::MentorFull);
        }

        let pending_key = DataKey::PendingMentee(mentor_id.clone(), mentee.clone());
        let mentee_key = DataKey::MenteeOf(mentor_id.clone(), mentee.clone());

        if env.storage().instance().has(&pending_key) || env.storage().instance().has(&mentee_key) {
            panic_with_error!(&env, ContractError::AlreadyRequested);
        }

        env.storage().instance().set(&pending_key, &true);
    }

    pub fn accept_mentee(env: Env, mentor_id: Symbol, mentor: Address, mentee: Address) {
        mentor.require_auth();

        let key = DataKey::Mentor(mentor_id.clone());
        let mut record: Mentor = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotFound));

        if record.mentor != mentor {
            panic_with_error!(&env, ContractError::NotAuthorized);
        }

        let pending_key = DataKey::PendingMentee(mentor_id.clone(), mentee.clone());
        if !env.storage().instance().has(&pending_key) {
            panic_with_error!(&env, ContractError::NotFound);
        }

        env.storage().instance().remove(&pending_key);

        let mentee_key = DataKey::MenteeOf(mentor_id.clone(), mentee.clone());
        env.storage().instance().set(&mentee_key, &true);

        record.current_mentees += 1;
        env.storage().instance().set(&key, &record);
    }

    pub fn complete_session(
        env: Env,
        mentor_id: Symbol,
        mentor: Address,
        hours: u32,
        session_notes: String,
    ) {
        mentor.require_auth();
        let _ = session_notes;

        let key = DataKey::Mentor(mentor_id.clone());
        let mut record: Mentor = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotFound));

        if record.mentor != mentor {
            panic_with_error!(&env, ContractError::NotAuthorized);
        }

        record.total_sessions += 1;
        record.total_hours += hours;
        env.storage().instance().set(&key, &record);
    }

    pub fn rate_mentor(env: Env, mentor_id: Symbol, mentee: Address, rating: u32) {
        mentee.require_auth();

        if rating < 1 || rating > 5 {
            panic_with_error!(&env, ContractError::InvalidRating);
        }

        let mentee_key = DataKey::MenteeOf(mentor_id.clone(), mentee.clone());
        if !env.storage().instance().has(&mentee_key) {
            panic_with_error!(&env, ContractError::NotMentee);
        }

        let key = DataKey::Mentor(mentor_id.clone());
        let mut record: Mentor = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotFound));

        record.total_rating += rating;
        record.rating_count += 1;
        env.storage().instance().set(&key, &record);
    }

    pub fn get_mentor(env: Env, id: Symbol) -> Option<Mentor> {
        env.storage().instance().get(&DataKey::Mentor(id))
    }

    pub fn list_mentors(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_mentor_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }
}
