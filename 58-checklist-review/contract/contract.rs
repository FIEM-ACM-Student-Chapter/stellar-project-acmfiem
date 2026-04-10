#![no_std]

use soroban_sdk::{ contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String, Symbol, Vec };

#[contracttype]
#[derive(Clone)]
pub struct ChecklistRecord {
    pub lead: Address,
    pub reviewer: Address,
    pub title: String,
    pub details: String,
    pub tag: Symbol,
    pub status: Symbol,
    pub check_count: u32,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum ChecklistRecordDataKey { IdList, Item(Symbol), Acted(Symbol, Address) }

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ChecklistRecordError { InvalidTitle = 1, InvalidTimestamp = 2, NotFound = 3, Unauthorized = 4, AlreadyExists = 5, AlreadyActed = 6, Closed = 7 }

#[contract]
pub struct ChecklistReviewContract;

#[contractimpl]
impl ChecklistReviewContract {
    fn ids_key() -> ChecklistRecordDataKey { ChecklistRecordDataKey::IdList }
    fn item_key(id: &Symbol) -> ChecklistRecordDataKey { ChecklistRecordDataKey::Item(id.clone()) }
    fn acted_key(id: &Symbol, actor: &Address) -> ChecklistRecordDataKey { ChecklistRecordDataKey::Acted(id.clone(), actor.clone()) }
    fn load_ids(env: &Env) -> Vec<Symbol> { env.storage().instance().get(&Self::ids_key()).unwrap_or(Vec::new(env)) }
    fn save_ids(env: &Env, ids: &Vec<Symbol>) { env.storage().instance().set(&Self::ids_key(), ids); }
    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool { for current in ids.iter() { if current == id.clone() { return true; } } false }

    pub fn create_checklist(env: Env, id: Symbol, lead: Address, title: String, details: String, tag: Symbol, created_at: u64) {
        lead.require_auth();
        if title.len() == 0 { panic_with_error!(&env, ChecklistRecordError::InvalidTitle); }
        if created_at == 0 { panic_with_error!(&env, ChecklistRecordError::InvalidTimestamp); }
        let key = Self::item_key(&id);
        if env.storage().instance().has(&key) { panic_with_error!(&env, ChecklistRecordError::AlreadyExists); }
        let item = ChecklistRecord { lead: lead.clone(), reviewer: lead, title, details, tag, status: Symbol::new(&env, "draft"), check_count: 0, created_at, updated_at: created_at };
        env.storage().instance().set(&key, &item);
        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) { ids.push_back(id); Self::save_ids(&env, &ids); }
    }

    pub fn submit_check(env: Env, id: Symbol, reviewer: Address) {
        reviewer.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<ChecklistRecord> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.status == Symbol::new(&env, "archived") { panic_with_error!(&env, ChecklistRecordError::Closed); }
            let acted_key = Self::acted_key(&id, &reviewer);
            let already_acted: bool = env.storage().instance().get(&acted_key).unwrap_or(false);
            if already_acted { panic_with_error!(&env, ChecklistRecordError::AlreadyActed); }
            item.reviewer = reviewer.clone();
            item.check_count += 1;
            item.status = Symbol::new(&env, "submitted");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
            env.storage().instance().set(&acted_key, &true);
        } else { panic_with_error!(&env, ChecklistRecordError::NotFound); }
    }

    pub fn approve_checklist(env: Env, id: Symbol, lead: Address) {
        lead.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<ChecklistRecord> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.lead != lead { panic_with_error!(&env, ChecklistRecordError::Unauthorized); }
            if item.status == Symbol::new(&env, "archived") { panic_with_error!(&env, ChecklistRecordError::Closed); }
            item.status = Symbol::new(&env, "approved");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
        } else { panic_with_error!(&env, ChecklistRecordError::NotFound); }
    }

    pub fn archive_checklist(env: Env, id: Symbol, lead: Address) {
        lead.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<ChecklistRecord> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.lead != lead { panic_with_error!(&env, ChecklistRecordError::Unauthorized); }
            if item.status == Symbol::new(&env, "archived") { panic_with_error!(&env, ChecklistRecordError::Closed); }
            item.status = Symbol::new(&env, "archived");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
        } else { panic_with_error!(&env, ChecklistRecordError::NotFound); }
    }

    pub fn get_checklist(env: Env, id: Symbol) -> Option<ChecklistRecord> { env.storage().instance().get(&Self::item_key(&id)) }
    pub fn list_checklists(env: Env) -> Vec<Symbol> { Self::load_ids(&env) }
    pub fn get_check_count(env: Env, id: Symbol) -> u32 { let maybe_item: Option<ChecklistRecord> = env.storage().instance().get(&Self::item_key(&id)); if let Some(item) = maybe_item { item.check_count } else { 0 } }
}
