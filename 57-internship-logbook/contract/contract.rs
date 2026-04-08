#![no_std]

use soroban_sdk::{ contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String, Symbol, Vec };

#[contracttype]
#[derive(Clone)]
pub struct InternshipLog {
    pub mentor: Address,
    pub intern: Address,
    pub title: String,
    pub details: String,
    pub tag: Symbol,
    pub status: Symbol,
    pub entry_count: u32,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum InternshipLogDataKey { IdList, Item(Symbol), Acted(Symbol, Address) }

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum InternshipLogError { InvalidTitle = 1, InvalidTimestamp = 2, NotFound = 3, Unauthorized = 4, AlreadyExists = 5, AlreadyActed = 6, Closed = 7 }

#[contract]
pub struct InternshipLogbookContract;

#[contractimpl]
impl InternshipLogbookContract {
    fn ids_key() -> InternshipLogDataKey { InternshipLogDataKey::IdList }
    fn item_key(id: &Symbol) -> InternshipLogDataKey { InternshipLogDataKey::Item(id.clone()) }
    fn acted_key(id: &Symbol, actor: &Address) -> InternshipLogDataKey { InternshipLogDataKey::Acted(id.clone(), actor.clone()) }
    fn load_ids(env: &Env) -> Vec<Symbol> { env.storage().instance().get(&Self::ids_key()).unwrap_or(Vec::new(env)) }
    fn save_ids(env: &Env, ids: &Vec<Symbol>) { env.storage().instance().set(&Self::ids_key(), ids); }
    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool { for current in ids.iter() { if current == id.clone() { return true; } } false }

    pub fn create_logbook(env: Env, id: Symbol, mentor: Address, title: String, details: String, tag: Symbol, created_at: u64) {
        mentor.require_auth();
        if title.len() == 0 { panic_with_error!(&env, InternshipLogError::InvalidTitle); }
        if created_at == 0 { panic_with_error!(&env, InternshipLogError::InvalidTimestamp); }
        let key = Self::item_key(&id);
        if env.storage().instance().has(&key) { panic_with_error!(&env, InternshipLogError::AlreadyExists); }
        let item = InternshipLog { mentor: mentor.clone(), intern: mentor, title, details, tag, status: Symbol::new(&env, "open"), entry_count: 0, created_at, updated_at: created_at };
        env.storage().instance().set(&key, &item);
        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) { ids.push_back(id); Self::save_ids(&env, &ids); }
    }

    pub fn add_entry(env: Env, id: Symbol, intern: Address) {
        intern.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<InternshipLog> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, InternshipLogError::Closed); }
            let acted_key = Self::acted_key(&id, &intern);
            let already_acted: bool = env.storage().instance().get(&acted_key).unwrap_or(false);
            if already_acted { panic_with_error!(&env, InternshipLogError::AlreadyActed); }
            item.intern = intern.clone();
            item.entry_count += 1;
            item.status = Symbol::new(&env, "updated");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
            env.storage().instance().set(&acted_key, &true);
        } else { panic_with_error!(&env, InternshipLogError::NotFound); }
    }

    pub fn approve_logbook(env: Env, id: Symbol, mentor: Address) {
        mentor.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<InternshipLog> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.mentor != mentor { panic_with_error!(&env, InternshipLogError::Unauthorized); }
            if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, InternshipLogError::Closed); }
            item.status = Symbol::new(&env, "approved");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
        } else { panic_with_error!(&env, InternshipLogError::NotFound); }
    }

    pub fn close_logbook(env: Env, id: Symbol, mentor: Address) {
        mentor.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<InternshipLog> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.mentor != mentor { panic_with_error!(&env, InternshipLogError::Unauthorized); }
            if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, InternshipLogError::Closed); }
            item.status = Symbol::new(&env, "closed");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
        } else { panic_with_error!(&env, InternshipLogError::NotFound); }
    }

    pub fn get_logbook(env: Env, id: Symbol) -> Option<InternshipLog> { env.storage().instance().get(&Self::item_key(&id)) }
    pub fn list_logbooks(env: Env) -> Vec<Symbol> { Self::load_ids(&env) }
    pub fn get_entry_count(env: Env, id: Symbol) -> u32 { let maybe_item: Option<InternshipLog> = env.storage().instance().get(&Self::item_key(&id)); if let Some(item) = maybe_item { item.entry_count } else { 0 } }
}
