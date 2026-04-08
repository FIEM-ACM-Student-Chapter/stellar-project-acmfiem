#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct ServiceRequest {
    pub requester: Address,
    pub provider: Address,
    pub title: String,
    pub description: String,
    pub priority: u32,
    pub category: Symbol,
    pub budget: i128,
    pub work_notes: String,
    pub rejection_reason: String,
    pub status: Symbol,
    pub created_at: u64,
    pub completed_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IdList,
    Item(Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ServiceError {
    NotFound = 1,
    InvalidTitle = 2,
    InvalidStatus = 3,
    NotRequester = 4,
    NotProvider = 5,
    AlreadyExists = 6,
    InvalidPriority = 7,
}

#[contract]
pub struct ServiceRequestContract;

#[contractimpl]
impl ServiceRequestContract {
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

    fn status_open(env: &Env) -> Symbol {
        Symbol::new(env, "open")
    }

    fn status_accepted(env: &Env) -> Symbol {
        Symbol::new(env, "accepted")
    }

    fn status_submitted(env: &Env) -> Symbol {
        Symbol::new(env, "submitted")
    }

    fn status_approved(env: &Env) -> Symbol {
        Symbol::new(env, "approved")
    }

    fn status_rejected(env: &Env) -> Symbol {
        Symbol::new(env, "rejected")
    }

    pub fn create_request(
        env: Env,
        id: Symbol,
        requester: Address,
        title: String,
        description: String,
        priority: u32,
        category: Symbol,
        budget: i128,
    ) {
        requester.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, ServiceError::InvalidTitle);
        }
        if priority < 1 || priority > 5 {
            panic_with_error!(&env, ServiceError::InvalidPriority);
        }

        let key = DataKey::Item(id.clone());
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, ServiceError::AlreadyExists);
        }

        let request = ServiceRequest {
            requester: requester.clone(),
            provider: requester,
            title,
            description,
            priority,
            category,
            budget,
            work_notes: String::from_str(&env, ""),
            rejection_reason: String::from_str(&env, ""),
            status: Self::status_open(&env),
            created_at: env.ledger().timestamp(),
            completed_at: 0,
        };

        env.storage().instance().set(&key, &request);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn accept_request(env: Env, id: Symbol, provider: Address) {
        provider.require_auth();

        let key = DataKey::Item(id.clone());
        let maybe: Option<ServiceRequest> = env.storage().instance().get(&key);

        if let Some(mut req) = maybe {
            if req.status != Self::status_open(&env) {
                panic_with_error!(&env, ServiceError::InvalidStatus);
            }
            req.provider = provider;
            req.status = Self::status_accepted(&env);
            env.storage().instance().set(&key, &req);
        } else {
            panic_with_error!(&env, ServiceError::NotFound);
        }
    }

    pub fn submit_work(env: Env, id: Symbol, provider: Address, work_notes: String) {
        provider.require_auth();

        let key = DataKey::Item(id.clone());
        let maybe: Option<ServiceRequest> = env.storage().instance().get(&key);

        if let Some(mut req) = maybe {
            if req.provider != provider {
                panic_with_error!(&env, ServiceError::NotProvider);
            }
            if req.status != Self::status_accepted(&env) {
                panic_with_error!(&env, ServiceError::InvalidStatus);
            }
            req.work_notes = work_notes;
            req.status = Self::status_submitted(&env);
            env.storage().instance().set(&key, &req);
        } else {
            panic_with_error!(&env, ServiceError::NotFound);
        }
    }

    pub fn approve_work(env: Env, id: Symbol, requester: Address) {
        requester.require_auth();

        let key = DataKey::Item(id.clone());
        let maybe: Option<ServiceRequest> = env.storage().instance().get(&key);

        if let Some(mut req) = maybe {
            if req.requester != requester {
                panic_with_error!(&env, ServiceError::NotRequester);
            }
            if req.status != Self::status_submitted(&env) {
                panic_with_error!(&env, ServiceError::InvalidStatus);
            }
            req.status = Self::status_approved(&env);
            req.completed_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &req);
        } else {
            panic_with_error!(&env, ServiceError::NotFound);
        }
    }

    pub fn reject_work(env: Env, id: Symbol, requester: Address, reason: String) {
        requester.require_auth();

        let key = DataKey::Item(id.clone());
        let maybe: Option<ServiceRequest> = env.storage().instance().get(&key);

        if let Some(mut req) = maybe {
            if req.requester != requester {
                panic_with_error!(&env, ServiceError::NotRequester);
            }
            if req.status != Self::status_submitted(&env) {
                panic_with_error!(&env, ServiceError::InvalidStatus);
            }
            req.rejection_reason = reason;
            req.status = Self::status_rejected(&env);
            env.storage().instance().set(&key, &req);
        } else {
            panic_with_error!(&env, ServiceError::NotFound);
        }
    }

    pub fn get_request(env: Env, id: Symbol) -> Option<ServiceRequest> {
        env.storage().instance().get(&DataKey::Item(id))
    }

    pub fn list_requests(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }
}
