#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct AuditEntry {
    pub actor: Address,
    pub action_type: Symbol,
    pub target: String,
    pub description: String,
    pub severity: u32,
    pub is_flagged: bool,
    pub flag_reason: String,
    pub access_type: Symbol,
    pub logged_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum AuditDataKey {
    IdList,
    Item(Symbol),
    Count,
    FlaggedCount,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AuditError {
    InvalidDescription = 1,
    InvalidTimestamp = 2,
    NotFound = 3,
    AlreadyFlagged = 4,
    InvalidSeverity = 5,
}

#[contract]
pub struct AuditLogTrackingContract;

#[contractimpl]
impl AuditLogTrackingContract {
    fn ids_key() -> AuditDataKey {
        AuditDataKey::IdList
    }

    fn item_key(id: &Symbol) -> AuditDataKey {
        AuditDataKey::Item(id.clone())
    }

    fn count_key() -> AuditDataKey {
        AuditDataKey::Count
    }

    fn flagged_count_key() -> AuditDataKey {
        AuditDataKey::FlaggedCount
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

    fn increment_count(env: &Env) {
        let count: u32 = env.storage().instance().get(&Self::count_key()).unwrap_or(0);
        env.storage().instance().set(&Self::count_key(), &(count + 1));
    }

    fn increment_flagged(env: &Env) {
        let count: u32 = env.storage().instance().get(&Self::flagged_count_key()).unwrap_or(0);
        env.storage().instance().set(&Self::flagged_count_key(), &(count + 1));
    }

    fn store_entry(env: &Env, id: &Symbol, entry: &AuditEntry) {
        let key = Self::item_key(id);
        let exists = env.storage().instance().has(&key);
        env.storage().instance().set(&key, entry);

        let mut ids = Self::load_ids(env);
        if !Self::has_id(&ids, id) {
            ids.push_back(id.clone());
            Self::save_ids(env, &ids);
            if !exists {
                Self::increment_count(env);
            }
        }
    }

    pub fn log_action(
        env: Env,
        id: Symbol,
        actor: Address,
        action_type: Symbol,
        target: String,
        description: String,
        severity: u32,
        timestamp: u64,
    ) {
        actor.require_auth();

        if description.len() == 0 {
            panic_with_error!(env, AuditError::InvalidDescription);
        }
        if timestamp == 0 {
            panic_with_error!(env, AuditError::InvalidTimestamp);
        }
        if severity > 5 {
            panic_with_error!(env, AuditError::InvalidSeverity);
        }

        let none_sym = Symbol::new(&env, "none");

        let entry = AuditEntry {
            actor,
            action_type,
            target,
            description,
            severity,
            is_flagged: false,
            flag_reason: String::from_str(&env, ""),
            access_type: none_sym,
            logged_at: timestamp,
        };

        Self::store_entry(&env, &id, &entry);
    }

    pub fn log_access(
        env: Env,
        id: Symbol,
        accessor: Address,
        resource: String,
        access_type: Symbol,
        timestamp: u64,
    ) {
        accessor.require_auth();

        if resource.len() == 0 {
            panic_with_error!(env, AuditError::InvalidDescription);
        }
        if timestamp == 0 {
            panic_with_error!(env, AuditError::InvalidTimestamp);
        }

        let access_sym = Symbol::new(&env, "access");

        let entry = AuditEntry {
            actor: accessor,
            action_type: access_sym,
            target: resource,
            description: String::from_str(&env, "Access log"),
            severity: 1,
            is_flagged: false,
            flag_reason: String::from_str(&env, ""),
            access_type,
            logged_at: timestamp,
        };

        Self::store_entry(&env, &id, &entry);
    }

    pub fn flag_entry(env: Env, id: Symbol, auditor: Address, reason: String) {
        auditor.require_auth();

        let key = Self::item_key(&id);
        let maybe_entry: Option<AuditEntry> = env.storage().instance().get(&key);

        if let Some(mut entry) = maybe_entry {
            if entry.is_flagged {
                panic_with_error!(env, AuditError::AlreadyFlagged);
            }
            entry.is_flagged = true;
            entry.flag_reason = reason;
            env.storage().instance().set(&key, &entry);
            Self::increment_flagged(&env);
        } else {
            panic_with_error!(env, AuditError::NotFound);
        }
    }

    pub fn get_entry(env: Env, id: Symbol) -> Option<AuditEntry> {
        env.storage().instance().get(&Self::item_key(&id))
    }

    pub fn list_entries(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_entry_count(env: Env) -> u32 {
        env.storage().instance().get(&Self::count_key()).unwrap_or(0)
    }

    pub fn get_flagged_count(env: Env) -> u32 {
        env.storage().instance().get(&Self::flagged_count_key()).unwrap_or(0)
    }
}
