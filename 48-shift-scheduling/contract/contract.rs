#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Shift {
    pub manager: Address,
    pub worker: Address,
    pub title: String,
    pub location: String,
    pub status: Symbol,
    pub assigned: bool,
    pub start_time: u64,
    pub end_time: u64,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum ShiftDataKey {
    IdList,
    Shift(Symbol),
    ActiveShiftCount,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ShiftError {
    InvalidTitle = 1,
    InvalidTimestamp = 2,
    NotFound = 3,
    Unauthorized = 4,
    AlreadyExists = 5,
    NotAssigned = 6,
    ShiftNotActive = 7,
}

#[contract]
pub struct ShiftSchedulingContract;

#[contractimpl]
impl ShiftSchedulingContract {
    fn ids_key() -> ShiftDataKey {
        ShiftDataKey::IdList
    }

    fn shift_key(id: &Symbol) -> ShiftDataKey {
        ShiftDataKey::Shift(id.clone())
    }

    fn active_count_key() -> ShiftDataKey {
        ShiftDataKey::ActiveShiftCount
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

    pub fn create_shift(
        env: Env,
        id: Symbol,
        manager: Address,
        title: String,
        location: String,
        start_time: u64,
        end_time: u64,
    ) {
        manager.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, ShiftError::InvalidTitle);
        }
        if start_time == 0 || end_time == 0 {
            panic_with_error!(&env, ShiftError::InvalidTimestamp);
        }

        let key = Self::shift_key(&id);
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, ShiftError::AlreadyExists);
        }

        let shift = Shift {
            manager: manager.clone(),
            worker: manager,
            title,
            location,
            status: Symbol::new(&env, "open"),
            assigned: false,
            start_time,
            end_time,
            created_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&key, &shift);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn assign_shift(env: Env, id: Symbol, manager: Address, worker: Address) {
        manager.require_auth();

        let key = Self::shift_key(&id);
        let maybe_shift: Option<Shift> = env.storage().instance().get(&key);

        if let Some(mut shift) = maybe_shift {
            if shift.manager != manager {
                panic_with_error!(&env, ShiftError::Unauthorized);
            }

            shift.worker = worker;
            shift.assigned = true;
            shift.status = Symbol::new(&env, "assigned");
            env.storage().instance().set(&key, &shift);
        } else {
            panic_with_error!(&env, ShiftError::NotFound);
        }
    }

    pub fn start_shift(env: Env, id: Symbol, worker: Address) {
        worker.require_auth();

        let key = Self::shift_key(&id);
        let maybe_shift: Option<Shift> = env.storage().instance().get(&key);

        if let Some(mut shift) = maybe_shift {
            if !shift.assigned {
                panic_with_error!(&env, ShiftError::NotAssigned);
            }
            if shift.worker != worker {
                panic_with_error!(&env, ShiftError::Unauthorized);
            }
            if shift.status != Symbol::new(&env, "assigned") {
                panic_with_error!(&env, ShiftError::ShiftNotActive);
            }

            shift.status = Symbol::new(&env, "active");
            env.storage().instance().set(&key, &shift);

            let active_count: u32 = env.storage().instance().get(&Self::active_count_key()).unwrap_or(0);
            env.storage().instance().set(&Self::active_count_key(), &(active_count + 1));
        } else {
            panic_with_error!(&env, ShiftError::NotFound);
        }
    }

    pub fn complete_shift(env: Env, id: Symbol, worker: Address) {
        worker.require_auth();

        let key = Self::shift_key(&id);
        let maybe_shift: Option<Shift> = env.storage().instance().get(&key);

        if let Some(mut shift) = maybe_shift {
            if shift.worker != worker {
                panic_with_error!(&env, ShiftError::Unauthorized);
            }
            if shift.status != Symbol::new(&env, "active") {
                panic_with_error!(&env, ShiftError::ShiftNotActive);
            }

            shift.status = Symbol::new(&env, "complete");
            env.storage().instance().set(&key, &shift);

            let active_count: u32 = env.storage().instance().get(&Self::active_count_key()).unwrap_or(0);
            if active_count > 0 {
                env.storage().instance().set(&Self::active_count_key(), &(active_count - 1));
            }
        } else {
            panic_with_error!(&env, ShiftError::NotFound);
        }
    }

    pub fn get_shift(env: Env, id: Symbol) -> Option<Shift> {
        env.storage().instance().get(&Self::shift_key(&id))
    }

    pub fn list_shifts(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_active_shift_count(env: Env) -> u32 {
        env.storage().instance().get(&Self::active_count_key()).unwrap_or(0)
    }
}

