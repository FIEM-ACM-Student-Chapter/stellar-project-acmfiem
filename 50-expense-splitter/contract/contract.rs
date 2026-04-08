#![no_std]

use soroban_sdk::{ contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String, Symbol, Vec };

#[contracttype]
#[derive(Clone)]
pub struct ExpenseGroup {
    pub owner: Address,
    pub contributor: Address,
    pub title: String,
    pub details: String,
    pub tag: Symbol,
    pub status: Symbol,
    pub expense_count: u32,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum ExpenseGroupDataKey { IdList, Item(Symbol), Acted(Symbol, Address) }

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ExpenseGroupError { InvalidTitle = 1, InvalidTimestamp = 2, NotFound = 3, Unauthorized = 4, AlreadyExists = 5, AlreadyActed = 6, Closed = 7 }

#[contract]
pub struct ExpenseSplitterContract;

#[contractimpl]
impl ExpenseSplitterContract {
    fn ids_key() -> ExpenseGroupDataKey { ExpenseGroupDataKey::IdList }
    fn item_key(id: &Symbol) -> ExpenseGroupDataKey { ExpenseGroupDataKey::Item(id.clone()) }
    fn acted_key(id: &Symbol, actor: &Address) -> ExpenseGroupDataKey { ExpenseGroupDataKey::Acted(id.clone(), actor.clone()) }
    fn load_ids(env: &Env) -> Vec<Symbol> { env.storage().instance().get(&Self::ids_key()).unwrap_or(Vec::new(env)) }
    fn save_ids(env: &Env, ids: &Vec<Symbol>) { env.storage().instance().set(&Self::ids_key(), ids); }
    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool { for current in ids.iter() { if current == id.clone() { return true; } } false }

    pub fn create_group(env: Env, id: Symbol, owner: Address, title: String, details: String, tag: Symbol, created_at: u64) {
        owner.require_auth();
        if title.len() == 0 { panic_with_error!(&env, ExpenseGroupError::InvalidTitle); }
        if created_at == 0 { panic_with_error!(&env, ExpenseGroupError::InvalidTimestamp); }
        let key = Self::item_key(&id);
        if env.storage().instance().has(&key) { panic_with_error!(&env, ExpenseGroupError::AlreadyExists); }
        let item = ExpenseGroup { owner: owner.clone(), contributor: owner, title, details, tag, status: Symbol::new(&env, "open"), expense_count: 0, created_at, updated_at: created_at };
        env.storage().instance().set(&key, &item);
        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) { ids.push_back(id); Self::save_ids(&env, &ids); }
    }

    pub fn add_expense(env: Env, id: Symbol, contributor: Address) {
        contributor.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<ExpenseGroup> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, ExpenseGroupError::Closed); }
            let acted_key = Self::acted_key(&id, &contributor);
            let already_acted: bool = env.storage().instance().get(&acted_key).unwrap_or(false);
            if already_acted { panic_with_error!(&env, ExpenseGroupError::AlreadyActed); }
            item.contributor = contributor.clone();
            item.expense_count += 1;
            item.status = Symbol::new(&env, "active");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
            env.storage().instance().set(&acted_key, &true);
        } else { panic_with_error!(&env, ExpenseGroupError::NotFound); }
    }

    pub fn settle_group(env: Env, id: Symbol, owner: Address) {
        owner.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<ExpenseGroup> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.owner != owner { panic_with_error!(&env, ExpenseGroupError::Unauthorized); }
            if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, ExpenseGroupError::Closed); }
            item.status = Symbol::new(&env, "settled");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
        } else { panic_with_error!(&env, ExpenseGroupError::NotFound); }
    }

    pub fn close_group(env: Env, id: Symbol, owner: Address) {
        owner.require_auth();
        let key = Self::item_key(&id);
        let maybe_item: Option<ExpenseGroup> = env.storage().instance().get(&key);
        if let Some(mut item) = maybe_item {
            if item.owner != owner { panic_with_error!(&env, ExpenseGroupError::Unauthorized); }
            if item.status == Symbol::new(&env, "closed") { panic_with_error!(&env, ExpenseGroupError::Closed); }
            item.status = Symbol::new(&env, "closed");
            item.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);
        } else { panic_with_error!(&env, ExpenseGroupError::NotFound); }
    }

    pub fn get_group(env: Env, id: Symbol) -> Option<ExpenseGroup> { env.storage().instance().get(&Self::item_key(&id)) }
    pub fn list_groups(env: Env) -> Vec<Symbol> { Self::load_ids(&env) }
    pub fn get_expense_count(env: Env, id: Symbol) -> u32 { let maybe_item: Option<ExpenseGroup> = env.storage().instance().get(&Self::item_key(&id)); if let Some(item) = maybe_item { item.expense_count } else { 0 } }
}
