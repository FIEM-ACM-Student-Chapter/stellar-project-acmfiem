#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct VisitorPass {
    pub host: Address,
    pub visitor: Address,
    pub purpose: String,
    pub location: String,
    pub status: Symbol,
    pub visit_time: u64,
    pub created_at: u64,
    pub check_in_at: u64,
    pub check_out_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum VisitorPassDataKey {
    IdList,
    Pass(Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VisitorPassError {
    InvalidPurpose = 1,
    InvalidTimestamp = 2,
    NotFound = 3,
    Unauthorized = 4,
    AlreadyExists = 5,
    PassNotApproved = 6,
    AlreadyCheckedIn = 7,
    AlreadyCheckedOut = 8,
    PassRevoked = 9,
    NotCheckedIn = 10,
}

#[contract]
pub struct VisitorPassManagementContract;

#[contractimpl]
impl VisitorPassManagementContract {
    fn ids_key() -> VisitorPassDataKey {
        VisitorPassDataKey::IdList
    }

    fn pass_key(id: &Symbol) -> VisitorPassDataKey {
        VisitorPassDataKey::Pass(id.clone())
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

    pub fn issue_pass(
        env: Env,
        id: Symbol,
        host: Address,
        visitor: Address,
        purpose: String,
        location: String,
        visit_time: u64,
    ) {
        host.require_auth();

        if purpose.len() == 0 {
            panic_with_error!(&env, VisitorPassError::InvalidPurpose);
        }
        if visit_time == 0 {
            panic_with_error!(&env, VisitorPassError::InvalidTimestamp);
        }

        let key = Self::pass_key(&id);
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, VisitorPassError::AlreadyExists);
        }

        let pass = VisitorPass {
            host,
            visitor,
            purpose,
            location,
            status: Symbol::new(&env, "pending"),
            visit_time,
            created_at: env.ledger().timestamp(),
            check_in_at: 0,
            check_out_at: 0,
        };

        env.storage().instance().set(&key, &pass);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn approve_pass(env: Env, id: Symbol, host: Address) {
        host.require_auth();

        let key = Self::pass_key(&id);
        let maybe_pass: Option<VisitorPass> = env.storage().instance().get(&key);

        if let Some(mut pass) = maybe_pass {
            if pass.host != host {
                panic_with_error!(&env, VisitorPassError::Unauthorized);
            }
            if pass.status == Symbol::new(&env, "revoked") {
                panic_with_error!(&env, VisitorPassError::PassRevoked);
            }
            let pending = Symbol::new(&env, "pending");
            let approved = Symbol::new(&env, "approved");
            if pass.status != pending && pass.status != approved {
                panic_with_error!(&env, VisitorPassError::PassNotApproved);
            }

            pass.status = approved;
            env.storage().instance().set(&key, &pass);
        } else {
            panic_with_error!(&env, VisitorPassError::NotFound);
        }
    }

    pub fn check_in_visitor(env: Env, id: Symbol, visitor: Address) {
        visitor.require_auth();

        let key = Self::pass_key(&id);
        let maybe_pass: Option<VisitorPass> = env.storage().instance().get(&key);

        if let Some(mut pass) = maybe_pass {
            if pass.visitor != visitor {
                panic_with_error!(&env, VisitorPassError::Unauthorized);
            }
            if pass.status == Symbol::new(&env, "revoked") {
                panic_with_error!(&env, VisitorPassError::PassRevoked);
            }
            if pass.status == Symbol::new(&env, "checked_in") {
                panic_with_error!(&env, VisitorPassError::AlreadyCheckedIn);
            }
            if pass.status != Symbol::new(&env, "approved") {
                panic_with_error!(&env, VisitorPassError::PassNotApproved);
            }

            pass.status = Symbol::new(&env, "checked_in");
            pass.check_in_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &pass);
        } else {
            panic_with_error!(&env, VisitorPassError::NotFound);
        }
    }

    pub fn check_out_visitor(env: Env, id: Symbol, visitor: Address) {
        visitor.require_auth();

        let key = Self::pass_key(&id);
        let maybe_pass: Option<VisitorPass> = env.storage().instance().get(&key);

        if let Some(mut pass) = maybe_pass {
            if pass.visitor != visitor {
                panic_with_error!(&env, VisitorPassError::Unauthorized);
            }
            if pass.status == Symbol::new(&env, "checked_out") {
                panic_with_error!(&env, VisitorPassError::AlreadyCheckedOut);
            }
            if pass.status != Symbol::new(&env, "checked_in") {
                panic_with_error!(&env, VisitorPassError::NotCheckedIn);
            }

            pass.status = Symbol::new(&env, "checked_out");
            pass.check_out_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &pass);
        } else {
            panic_with_error!(&env, VisitorPassError::NotFound);
        }
    }

    pub fn revoke_pass(env: Env, id: Symbol, host: Address) {
        host.require_auth();

        let key = Self::pass_key(&id);
        let maybe_pass: Option<VisitorPass> = env.storage().instance().get(&key);

        if let Some(mut pass) = maybe_pass {
            if pass.host != host {
                panic_with_error!(&env, VisitorPassError::Unauthorized);
            }
            if pass.status == Symbol::new(&env, "checked_out") {
                panic_with_error!(&env, VisitorPassError::AlreadyCheckedOut);
            }
            if pass.status == Symbol::new(&env, "revoked") {
                panic_with_error!(&env, VisitorPassError::PassRevoked);
            }

            pass.status = Symbol::new(&env, "revoked");
            env.storage().instance().set(&key, &pass);
        } else {
            panic_with_error!(&env, VisitorPassError::NotFound);
        }
    }

    pub fn get_pass(env: Env, id: Symbol) -> Option<VisitorPass> {
        env.storage().instance().get(&Self::pass_key(&id))
    }

    pub fn list_passes(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }
}


