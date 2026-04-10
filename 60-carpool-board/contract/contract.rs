#![no_std]

use soroban_sdk::{ contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String, Symbol, Vec };

#[contracttype]
#[derive(Clone)]
pub struct CarpoolTrip {
    pub driver: Address,
    pub rider: Address,
    pub title: String,
    pub details: String,
    pub tag: Symbol,
    pub status: Symbol,
    pub rider_count: u32,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum CarpoolTripDataKey { IdList, Item(Symbol), Acted(Symbol, Address) }

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CarpoolTripError { InvalidTitle = 1, InvalidTimestamp = 2, NotFound = 3, Unauthorized = 4, AlreadyExists = 5, AlreadyActed = 6, Closed = 7 }

#[contract]
pub struct CarpoolBoardContract;

#[contractimpl]
impl CarpoolBoardContract {
    fn ids_key() -> CarpoolTripDataKey { CarpoolTripDataKey::IdList }
    fn item_key(id: &Symbol) -> CarpoolTripDataKey { CarpoolTripDataKey::Item(id.clone()) }
    fn acted_key(id: &Symbol, actor: &Address) -> CarpoolTripDataKey { CarpoolTripDataKey::Acted(id.clone(), actor.clone()) }
    fn load_ids(env: &Env) -> Vec<Symbol> { env.storage().instance().get(&Self::ids_key()).unwrap_or(Vec::new(env)) }
    fn save_ids(env: &Env, ids: &Vec<Symbol>) { env.storage().instance().set(&Self::ids_key(), ids); }
    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool { for current in ids.iter() { if current == id.clone() { return true; } } false }

    pub fn create_trip(env: Env, id: Symbol, driver: Address, title: String, details: String, tag: Symbol, created_at: u64) {
        driver.require_auth();
        if title.len() == 0 { panic_with_error!(&env, CarpoolTripError::InvalidTitle); }
        if created_at == 0 { panic_with_error!(&env, CarpoolTripError::InvalidTimestamp); }
        let key = Self::item_key(&id);
        if env.storage().instance().has(&key) { panic_with_error!(&env, CarpoolTripError::AlreadyExists); }
        let item = CarpoolTrip { driver: driver.clone(), rider: driver, title, details, tag, status: Symbol::new(&env, "open"), rider_count: 0, created_at, updated_at: created_at };
        env.storage().instance().set(&key, &item);
        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) { ids.push_back(id); Self::save_ids(&env, &ids); }
    }

    pub fn join_trip(env: Env, id: Symbol, rider: Address) {
        rider.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<CarpoolTrip> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, CarpoolTripError::Closed); }
            let acted_key = Self::acted_key(&id, &rider);
            let already_acted: bool = env.storage().instance().get(&acted_key).unwrap_or(false);
            if already_acted { panic_with_error!(&env, CarpoolTripError::AlreadyActed); }
            item.rider = rider.clone();
            item.rider_count += 1;
            item.status = Symbol::new(&env, "joined");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
            env.storage().instance().set(&acted_key, &true);
        } else { panic_with_error!(&env, CarpoolTripError::NotFound); }
    }

    pub fn confirm_trip(env: Env, id: Symbol, driver: Address) {
        driver.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<CarpoolTrip> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.driver != driver { panic_with_error!(&env, CarpoolTripError::Unauthorized); }
            if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, CarpoolTripError::Closed); }
            item.status = Symbol::new(&env, "confirmed");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
        } else { panic_with_error!(&env, CarpoolTripError::NotFound); }
    }

    pub fn close_trip(env: Env, id: Symbol, driver: Address) {
        driver.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<CarpoolTrip> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.driver != driver { panic_with_error!(&env, CarpoolTripError::Unauthorized); }
            if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, CarpoolTripError::Closed); }
            item.status = Symbol::new(&env, "closed");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
        } else { panic_with_error!(&env, CarpoolTripError::NotFound); }
    }

    pub fn get_trip(env: Env, id: Symbol) -> Option<CarpoolTrip> { env.storage().instance().get(&Self::item_key(&id)) }
    pub fn list_trips(env: Env) -> Vec<Symbol> { Self::load_ids(&env) }
    pub fn get_rider_count(env: Env, id: Symbol) -> u32 { let maybe_item: Option<CarpoolTrip> = env.storage().instance().get(&Self::item_key(&id)); if let Some(item) = maybe_item { item.rider_count } else { 0 } }
}
