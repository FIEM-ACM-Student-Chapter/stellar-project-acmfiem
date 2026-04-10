#![no_std]

use soroban_sdk::{ contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String, Symbol, Vec };

#[contracttype]
#[derive(Clone)]
pub struct FeedbackRecord {
    pub moderator: Address,
    pub reviewer: Address,
    pub title: String,
    pub details: String,
    pub tag: Symbol,
    pub status: Symbol,
    pub review_count: u32,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum FeedbackRecordDataKey { IdList, Item(Symbol), Acted(Symbol, Address) }

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FeedbackRecordError { InvalidTitle = 1, InvalidTimestamp = 2, NotFound = 3, Unauthorized = 4, AlreadyExists = 5, AlreadyActed = 6, Closed = 7 }

#[contract]
pub struct FeedbackBoardContract;

#[contractimpl]
impl FeedbackBoardContract {
    fn ids_key() -> FeedbackRecordDataKey { FeedbackRecordDataKey::IdList }
    fn item_key(id: &Symbol) -> FeedbackRecordDataKey { FeedbackRecordDataKey::Item(id.clone()) }
    fn acted_key(id: &Symbol, actor: &Address) -> FeedbackRecordDataKey { FeedbackRecordDataKey::Acted(id.clone(), actor.clone()) }
    fn load_ids(env: &Env) -> Vec<Symbol> { env.storage().instance().get(&Self::ids_key()).unwrap_or(Vec::new(env)) }
    fn save_ids(env: &Env, ids: &Vec<Symbol>) { env.storage().instance().set(&Self::ids_key(), ids); }
    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool { for current in ids.iter() { if current == id.clone() { return true; } } false }

    pub fn create_feedback(env: Env, id: Symbol, moderator: Address, title: String, details: String, tag: Symbol, created_at: u64) {
        moderator.require_auth();
        if title.len() == 0 { panic_with_error!(&env, FeedbackRecordError::InvalidTitle); }
        if created_at == 0 { panic_with_error!(&env, FeedbackRecordError::InvalidTimestamp); }
        let key = Self::item_key(&id);
        if env.storage().instance().has(&key) { panic_with_error!(&env, FeedbackRecordError::AlreadyExists); }
        let item = FeedbackRecord { moderator: moderator.clone(), reviewer: moderator, title, details, tag, status: Symbol::new(&env, "open"), review_count: 0, created_at, updated_at: created_at };
        env.storage().instance().set(&key, &item);
        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) { ids.push_back(id); Self::save_ids(&env, &ids); }
    }

    pub fn add_review(env: Env, id: Symbol, reviewer: Address) {
        reviewer.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<FeedbackRecord> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, FeedbackRecordError::Closed); }
            let acted_key = Self::acted_key(&id, &reviewer);
            let already_acted: bool = env.storage().instance().get(&acted_key).unwrap_or(false);
            if already_acted { panic_with_error!(&env, FeedbackRecordError::AlreadyActed); }
            item.reviewer = reviewer.clone();
            item.review_count += 1;
            item.status = Symbol::new(&env, "reviewed");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
            env.storage().instance().set(&acted_key, &true);
        } else { panic_with_error!(&env, FeedbackRecordError::NotFound); }
    }

    pub fn approve_feedback(env: Env, id: Symbol, moderator: Address) {
        moderator.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<FeedbackRecord> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.moderator != moderator { panic_with_error!(&env, FeedbackRecordError::Unauthorized); }
            if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, FeedbackRecordError::Closed); }
            item.status = Symbol::new(&env, "approved");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
        } else { panic_with_error!(&env, FeedbackRecordError::NotFound); }
    }

    pub fn close_feedback(env: Env, id: Symbol, moderator: Address) {
        moderator.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<FeedbackRecord> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.moderator != moderator { panic_with_error!(&env, FeedbackRecordError::Unauthorized); }
            if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, FeedbackRecordError::Closed); }
            item.status = Symbol::new(&env, "closed");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
        } else { panic_with_error!(&env, FeedbackRecordError::NotFound); }
    }

    pub fn get_feedback(env: Env, id: Symbol) -> Option<FeedbackRecord> { env.storage().instance().get(&Self::item_key(&id)) }
    pub fn list_feedbacks(env: Env) -> Vec<Symbol> { Self::load_ids(&env) }
    pub fn get_review_count(env: Env, id: Symbol) -> u32 { let maybe_item: Option<FeedbackRecord> = env.storage().instance().get(&Self::item_key(&id)); if let Some(item) = maybe_item { item.review_count } else { 0 } }
}
