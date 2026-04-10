#![no_std]

use soroban_sdk::{ contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String, Symbol, Vec };

#[contracttype]
#[derive(Clone)]
pub struct GrantRequestRecord {
    pub coordinator: Address,
    pub applicant: Address,
    pub title: String,
    pub details: String,
    pub tag: Symbol,
    pub status: Symbol,
    pub request_count: u32,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum GrantRequestDataKey { IdList, Item(Symbol), Acted(Symbol, Address) }

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum GrantRequestError { InvalidTitle = 1, InvalidTimestamp = 2, NotFound = 3, Unauthorized = 4, AlreadyExists = 5, AlreadyActed = 6, Closed = 7 }

#[contract]
pub struct GrantRequestContract;

#[contractimpl]
impl GrantRequestContract {
    fn ids_key() -> GrantRequestDataKey { GrantRequestDataKey::IdList }
    fn item_key(id: &Symbol) -> GrantRequestDataKey { GrantRequestDataKey::Item(id.clone()) }
    fn acted_key(id: &Symbol, actor: &Address) -> GrantRequestDataKey { GrantRequestDataKey::Acted(id.clone(), actor.clone()) }
    fn load_ids(env: &Env) -> Vec<Symbol> { env.storage().instance().get(&Self::ids_key()).unwrap_or(Vec::new(env)) }
    fn save_ids(env: &Env, ids: &Vec<Symbol>) { env.storage().instance().set(&Self::ids_key(), ids); }
    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool { for current in ids.iter() { if current == id.clone() { return true; } } false }

    pub fn create_request(env: Env, id: Symbol, coordinator: Address, title: String, details: String, tag: Symbol, created_at: u64) {
        coordinator.require_auth();
        if title.len() == 0 { panic_with_error!(&env, GrantRequestError::InvalidTitle); }
        if created_at == 0 { panic_with_error!(&env, GrantRequestError::InvalidTimestamp); }
        let key = Self::item_key(&id);
        if env.storage().instance().has(&key) { panic_with_error!(&env, GrantRequestError::AlreadyExists); }
        let item = GrantRequestRecord { coordinator: coordinator.clone(), applicant: coordinator, title, details, tag, status: Symbol::new(&env, "draft"), request_count: 0, created_at, updated_at: created_at };
        env.storage().instance().set(&key, &item);
        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) { ids.push_back(id); Self::save_ids(&env, &ids); }
    }

    pub fn submit_request(env: Env, id: Symbol, applicant: Address) {
        applicant.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<GrantRequestRecord> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, GrantRequestError::Closed); }
            let acted_key = Self::acted_key(&id, &applicant);
            let already_acted: bool = env.storage().instance().get(&acted_key).unwrap_or(false);
            if already_acted { panic_with_error!(&env, GrantRequestError::AlreadyActed); }
            item.applicant = applicant.clone();
            item.request_count += 1;
            item.status = Symbol::new(&env, "submitted");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
            env.storage().instance().set(&acted_key, &true);
        } else { panic_with_error!(&env, GrantRequestError::NotFound); }
    }

    pub fn approve_request(env: Env, id: Symbol, coordinator: Address) {
        coordinator.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<GrantRequestRecord> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.coordinator != coordinator { panic_with_error!(&env, GrantRequestError::Unauthorized); }
            if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, GrantRequestError::Closed); }
            item.status = Symbol::new(&env, "approved");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
        } else { panic_with_error!(&env, GrantRequestError::NotFound); }
    }

    pub fn close_request(env: Env, id: Symbol, coordinator: Address) {
        coordinator.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<GrantRequestRecord> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.coordinator != coordinator { panic_with_error!(&env, GrantRequestError::Unauthorized); }
            if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, GrantRequestError::Closed); }
            item.status = Symbol::new(&env, "closed");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
        } else { panic_with_error!(&env, GrantRequestError::NotFound); }
    }

    pub fn get_request(env: Env, id: Symbol) -> Option<GrantRequestRecord> { env.storage().instance().get(&Self::item_key(&id)) }
    pub fn list_requests(env: Env) -> Vec<Symbol> { Self::load_ids(&env) }
    pub fn get_request_count(env: Env, id: Symbol) -> u32 { let maybe_item: Option<GrantRequestRecord> = env.storage().instance().get(&Self::item_key(&id)); if let Some(item) = maybe_item { item.request_count } else { 0 } }
}
