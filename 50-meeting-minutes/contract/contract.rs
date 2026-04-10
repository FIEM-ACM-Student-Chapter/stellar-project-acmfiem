#![no_std]

use soroban_sdk::{ contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String, Symbol, Vec };

#[contracttype]
#[derive(Clone)]
pub struct MeetingRecord {
    pub host: Address,
    pub note_taker: Address,
    pub title: String,
    pub details: String,
    pub tag: Symbol,
    pub status: Symbol,
    pub note_count: u32,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum MeetingRecordDataKey { IdList, Item(Symbol), Acted(Symbol, Address) }

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MeetingRecordError { InvalidTitle = 1, InvalidTimestamp = 2, NotFound = 3, Unauthorized = 4, AlreadyExists = 5, AlreadyActed = 6, Closed = 7 }

#[contract]
pub struct MeetingMinutesContract;

#[contractimpl]
impl MeetingMinutesContract {
    fn ids_key() -> MeetingRecordDataKey { MeetingRecordDataKey::IdList }
    fn item_key(id: &Symbol) -> MeetingRecordDataKey { MeetingRecordDataKey::Item(id.clone()) }
    fn acted_key(id: &Symbol, actor: &Address) -> MeetingRecordDataKey { MeetingRecordDataKey::Acted(id.clone(), actor.clone()) }
    fn load_ids(env: &Env) -> Vec<Symbol> { env.storage().instance().get(&Self::ids_key()).unwrap_or(Vec::new(env)) }
    fn save_ids(env: &Env, ids: &Vec<Symbol>) { env.storage().instance().set(&Self::ids_key(), ids); }
    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool { for current in ids.iter() { if current == id.clone() { return true; } } false }
    pub fn create_meeting(env: Env, id: Symbol, host: Address, title: String, details: String, tag: Symbol, created_at: u64) { host.require_auth(); if title.len() == 0 { panic_with_error!(&env, MeetingRecordError::InvalidTitle); } if created_at == 0 { panic_with_error!(&env, MeetingRecordError::InvalidTimestamp); } let key = Self::item_key(&id); if env.storage().instance().has(&key) { panic_with_error!(&env, MeetingRecordError::AlreadyExists); } let item = MeetingRecord { host: host.clone(), note_taker: host, title, details, tag, status: Symbol::new(&env, "draft"), note_count: 0, created_at, updated_at: created_at }; env.storage().instance().set(&key, &item); let mut ids = Self::load_ids(&env); if !Self::has_id(&ids, &id) { ids.push_back(id); Self::save_ids(&env, &ids); } }
    pub fn add_note(env: Env, id: Symbol, note_taker: Address) { note_taker.require_auth(); let key = Self::item_key(&id); let maybe_item: Option<MeetingRecord> = env.storage().instance().get(&key); if let Some(mut item) = maybe_item { if item.status == Symbol::new(&env, "archived") { panic_with_error!(&env, MeetingRecordError::Closed); } let acted_key = Self::acted_key(&id, &note_taker); let already_acted: bool = env.storage().instance().get(&acted_key).unwrap_or(false); if already_acted { panic_with_error!(&env, MeetingRecordError::AlreadyActed); } item.note_taker = note_taker.clone(); item.note_count += 1; item.status = Symbol::new(&env, "recording"); item.updated_at = env.ledger().timestamp(); env.storage().instance().set(&key, &item); env.storage().instance().set(&acted_key, &true); } else { panic_with_error!(&env, MeetingRecordError::NotFound); } }
    pub fn approve_minutes(env: Env, id: Symbol, host: Address) { host.require_auth(); let key = Self::item_key(&id); let maybe_item: Option<MeetingRecord> = env.storage().instance().get(&key); if let Some(mut item) = maybe_item { if item.host != host { panic_with_error!(&env, MeetingRecordError::Unauthorized); } if item.status == Symbol::new(&env, "archived") { panic_with_error!(&env, MeetingRecordError::Closed); } item.status = Symbol::new(&env, "approved"); item.updated_at = env.ledger().timestamp(); env.storage().instance().set(&key, &item); } else { panic_with_error!(&env, MeetingRecordError::NotFound); } }
    pub fn archive_meeting(env: Env, id: Symbol, host: Address) { host.require_auth(); let key = Self::item_key(&id); let maybe_item: Option<MeetingRecord> = env.storage().instance().get(&key); if let Some(mut item) = maybe_item { if item.host != host { panic_with_error!(&env, MeetingRecordError::Unauthorized); } if item.status == Symbol::new(&env, "archived") { panic_with_error!(&env, MeetingRecordError::Closed); } item.status = Symbol::new(&env, "archived"); item.updated_at = env.ledger().timestamp(); env.storage().instance().set(&key, &item); } else { panic_with_error!(&env, MeetingRecordError::NotFound); } }
    pub fn get_meeting(env: Env, id: Symbol) -> Option<MeetingRecord> { env.storage().instance().get(&Self::item_key(&id)) }
    pub fn list_meetings(env: Env) -> Vec<Symbol> { Self::load_ids(&env) }
    pub fn get_note_count(env: Env, id: Symbol) -> u32 { let maybe_item: Option<MeetingRecord> = env.storage().instance().get(&Self::item_key(&id)); if let Some(item) = maybe_item { item.note_count } else { 0 } }
}
