#![no_std]

use soroban_sdk::{ contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String, Symbol, Vec };

#[contracttype]
#[derive(Clone)]
pub struct EquipmentItem {
    pub custodian: Address,
    pub borrower: Address,
    pub title: String,
    pub details: String,
    pub tag: Symbol,
    pub status: Symbol,
    pub checkout_count: u32,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum EquipmentItemDataKey { IdList, Item(Symbol), Acted(Symbol, Address) }

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EquipmentItemError { InvalidTitle = 1, InvalidTimestamp = 2, NotFound = 3, Unauthorized = 4, AlreadyExists = 5, AlreadyActed = 6, Closed = 7 }

#[contract]
pub struct EquipmentCheckoutContract;

#[contractimpl]
impl EquipmentCheckoutContract {
    fn ids_key() -> EquipmentItemDataKey { EquipmentItemDataKey::IdList }
    fn item_key(id: &Symbol) -> EquipmentItemDataKey { EquipmentItemDataKey::Item(id.clone()) }
    fn acted_key(id: &Symbol, actor: &Address) -> EquipmentItemDataKey { EquipmentItemDataKey::Acted(id.clone(), actor.clone()) }
    fn load_ids(env: &Env) -> Vec<Symbol> { env.storage().instance().get(&Self::ids_key()).unwrap_or(Vec::new(env)) }
    fn save_ids(env: &Env, ids: &Vec<Symbol>) { env.storage().instance().set(&Self::ids_key(), ids); }
    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool { for current in ids.iter() { if current == id.clone() { return true; } } false }

    pub fn create_equipment(env: Env, id: Symbol, custodian: Address, title: String, details: String, tag: Symbol, created_at: u64) {
        custodian.require_auth();
        if title.len() == 0 { panic_with_error!(&env, EquipmentItemError::InvalidTitle); }
        if created_at == 0 { panic_with_error!(&env, EquipmentItemError::InvalidTimestamp); }
        let key = Self::item_key(&id);
        if env.storage().instance().has(&key) { panic_with_error!(&env, EquipmentItemError::AlreadyExists); }
        let item = EquipmentItem { custodian: custodian.clone(), borrower: custodian, title, details, tag, status: Symbol::new(&env, "available"), checkout_count: 0, created_at, updated_at: created_at };
        env.storage().instance().set(&key, &item);
        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) { ids.push_back(id); Self::save_ids(&env, &ids); }
    }

    pub fn checkout_equipment(env: Env, id: Symbol, borrower: Address) {
        borrower.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<EquipmentItem> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.status == Symbol::new(&env, "retired") { panic_with_error!(&env, EquipmentItemError::Closed); }
            let acted_key = Self::acted_key(&id, &borrower);
            let already_acted: bool = env.storage().instance().get(&acted_key).unwrap_or(false);
            if already_acted { panic_with_error!(&env, EquipmentItemError::AlreadyActed); }
            item.borrower = borrower.clone();
            item.checkout_count += 1;
            item.status = Symbol::new(&env, "checked_out");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
            env.storage().instance().set(&acted_key, &true);
        } else { panic_with_error!(&env, EquipmentItemError::NotFound); }
    }

    pub fn return_equipment(env: Env, id: Symbol, custodian: Address) {
        custodian.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<EquipmentItem> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.custodian != custodian { panic_with_error!(&env, EquipmentItemError::Unauthorized); }
            if item.status == Symbol::new(&env, "retired") { panic_with_error!(&env, EquipmentItemError::Closed); }
            item.status = Symbol::new(&env, "returned");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
        } else { panic_with_error!(&env, EquipmentItemError::NotFound); }
    }

    pub fn retire_equipment(env: Env, id: Symbol, custodian: Address) {
        custodian.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<EquipmentItem> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.custodian != custodian { panic_with_error!(&env, EquipmentItemError::Unauthorized); }
            if item.status == Symbol::new(&env, "retired") { panic_with_error!(&env, EquipmentItemError::Closed); }
            item.status = Symbol::new(&env, "retired");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
        } else { panic_with_error!(&env, EquipmentItemError::NotFound); }
    }

    pub fn get_equipment(env: Env, id: Symbol) -> Option<EquipmentItem> { env.storage().instance().get(&Self::item_key(&id)) }
    pub fn list_equipments(env: Env) -> Vec<Symbol> { Self::load_ids(&env) }
    pub fn get_checkout_count(env: Env, id: Symbol) -> u32 { let maybe_item: Option<EquipmentItem> = env.storage().instance().get(&Self::item_key(&id)); if let Some(item) = maybe_item { item.checkout_count } else { 0 } }
}

