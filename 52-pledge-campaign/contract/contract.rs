#![no_std]

use soroban_sdk::{ contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String, Symbol, Vec };

#[contracttype]
#[derive(Clone)]
pub struct PledgeRecord {
    pub organizer: Address,
    pub supporter: Address,
    pub title: String,
    pub details: String,
    pub tag: Symbol,
    pub status: Symbol,
    pub pledge_count: u32,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum PledgeRecordDataKey { IdList, Item(Symbol), Acted(Symbol, Address) }

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum PledgeRecordError { InvalidTitle = 1, InvalidTimestamp = 2, NotFound = 3, Unauthorized = 4, AlreadyExists = 5, AlreadyActed = 6, Closed = 7 }

#[contract]
pub struct PledgeCampaignContract;

#[contractimpl]
impl PledgeCampaignContract {
    fn ids_key() -> PledgeRecordDataKey { PledgeRecordDataKey::IdList }
    fn item_key(id: &Symbol) -> PledgeRecordDataKey { PledgeRecordDataKey::Item(id.clone()) }
    fn acted_key(id: &Symbol, actor: &Address) -> PledgeRecordDataKey { PledgeRecordDataKey::Acted(id.clone(), actor.clone()) }
    fn load_ids(env: &Env) -> Vec<Symbol> { env.storage().instance().get(&Self::ids_key()).unwrap_or(Vec::new(env)) }
    fn save_ids(env: &Env, ids: &Vec<Symbol>) { env.storage().instance().set(&Self::ids_key(), ids); }
    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool { for current in ids.iter() { if current == id.clone() { return true; } } false }
    pub fn create_pledge(env: Env, id: Symbol, organizer: Address, title: String, details: String, tag: Symbol, created_at: u64) { organizer.require_auth(); if title.len() == 0 { panic_with_error!(&env, PledgeRecordError::InvalidTitle); } if created_at == 0 { panic_with_error!(&env, PledgeRecordError::InvalidTimestamp); } let key = Self::item_key(&id); if env.storage().instance().has(&key) { panic_with_error!(&env, PledgeRecordError::AlreadyExists); } let item = PledgeRecord { organizer: organizer.clone(), supporter: organizer, title, details, tag, status: Symbol::new(&env, "open"), pledge_count: 0, created_at, updated_at: created_at }; env.storage().instance().set(&key, &item); let mut ids = Self::load_ids(&env); if !Self::has_id(&ids, &id) { ids.push_back(id); Self::save_ids(&env, &ids); } }
    pub fn make_pledge(env: Env, id: Symbol, supporter: Address) { supporter.require_auth(); let key = Self::item_key(&id); let maybe_item: Option<PledgeRecord> = env.storage().instance().get(&key); if let Some(mut item) = maybe_item { if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, PledgeRecordError::Closed); } let acted_key = Self::acted_key(&id, &supporter); let already_acted: bool = env.storage().instance().get(&acted_key).unwrap_or(false); if already_acted { panic_with_error!(&env, PledgeRecordError::AlreadyActed); } item.supporter = supporter.clone(); item.pledge_count += 1; item.status = Symbol::new(&env, "pledged"); item.updated_at = env.ledger().timestamp(); env.storage().instance().set(&key, &item); env.storage().instance().set(&acted_key, &true); } else { panic_with_error!(&env, PledgeRecordError::NotFound); } }
    pub fn confirm_pledge(env: Env, id: Symbol, organizer: Address) { organizer.require_auth(); let key = Self::item_key(&id); let maybe_item: Option<PledgeRecord> = env.storage().instance().get(&key); if let Some(mut item) = maybe_item { if item.organizer != organizer { panic_with_error!(&env, PledgeRecordError::Unauthorized); } if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, PledgeRecordError::Closed); } item.status = Symbol::new(&env, "confirmed"); item.updated_at = env.ledger().timestamp(); env.storage().instance().set(&key, &item); } else { panic_with_error!(&env, PledgeRecordError::NotFound); } }
    pub fn close_pledge(env: Env, id: Symbol, organizer: Address) { organizer.require_auth(); let key = Self::item_key(&id); let maybe_item: Option<PledgeRecord> = env.storage().instance().get(&key); if let Some(mut item) = maybe_item { if item.organizer != organizer { panic_with_error!(&env, PledgeRecordError::Unauthorized); } if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, PledgeRecordError::Closed); } item.status = Symbol::new(&env, "closed"); item.updated_at = env.ledger().timestamp(); env.storage().instance().set(&key, &item); } else { panic_with_error!(&env, PledgeRecordError::NotFound); } }
    pub fn get_pledge(env: Env, id: Symbol) -> Option<PledgeRecord> { env.storage().instance().get(&Self::item_key(&id)) }
    pub fn list_pledges(env: Env) -> Vec<Symbol> { Self::load_ids(&env) }
    pub fn get_pledge_count(env: Env, id: Symbol) -> u32 { let maybe_item: Option<PledgeRecord> = env.storage().instance().get(&Self::item_key(&id)); if let Some(item) = maybe_item { item.pledge_count } else { 0 } }
}
