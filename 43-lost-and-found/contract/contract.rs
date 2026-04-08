#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Item {
    pub reporter: Address,
    pub claimant: Address,
    pub name: String,
    pub description: String,
    pub category: Symbol,
    pub status: Symbol,
    pub is_claimed: bool,
    pub created_at: u64,
    pub resolved_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum ItemDataKey {
    IdList,
    Item(Symbol),
    OpenCount,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum LostFoundError {
    InvalidName = 1,
    InvalidTimestamp = 2,
    NotFound = 3,
    Unauthorized = 4,
    AlreadyExists = 5,
    AlreadyClaimed = 6,
    AlreadyResolved = 7,
}

#[contract]
pub struct LostAndFoundContract;

#[contractimpl]
impl LostAndFoundContract {
    fn ids_key() -> ItemDataKey {
        ItemDataKey::IdList
    }

    fn item_key(id: &Symbol) -> ItemDataKey {
        ItemDataKey::Item(id.clone())
    }

    fn open_count_key() -> ItemDataKey {
        ItemDataKey::OpenCount
    }

    fn load_ids(env: &Env) -> Vec<Symbol> {
        env.storage().instance().get(&Self::ids_key()).unwrap_or(Vec::new(env))
    }

    fn save_ids(env: &Env, ids: &Vec<Symbol>) {
        env.storage().instance().set(&Self::ids_key(), ids);
    }

    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool {
        for current in ids.iter() {
            if current == id.clone() {
                return true;
            }
        }
        false
    }

    pub fn report_item(
        env: Env,
        id: Symbol,
        reporter: Address,
        name: String,
        description: String,
        category: Symbol,
        reported_at: u64,
    ) {
        reporter.require_auth();

        if name.len() == 0 {
            panic_with_error!(&env, LostFoundError::InvalidName);
        }
        if reported_at == 0 {
            panic_with_error!(&env, LostFoundError::InvalidTimestamp);
        }

        let key = Self::item_key(&id);
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, LostFoundError::AlreadyExists);
        }

        let item = Item {
            reporter: reporter.clone(),
            claimant: reporter,
            name,
            description,
            category,
            status: Symbol::new(&env, "open"),
            is_claimed: false,
            created_at: reported_at,
            resolved_at: 0,
        };

        env.storage().instance().set(&key, &item);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }

        let count: u32 = env.storage().instance().get(&Self::open_count_key()).unwrap_or(0);
        env.storage().instance().set(&Self::open_count_key(), &(count + 1));
    }

    pub fn claim_item(env: Env, id: Symbol, claimant: Address) {
        claimant.require_auth();

        let key = Self::item_key(&id);
        let maybe_item: Option<Item> = env.storage().instance().get(&key);

        if let Some(mut item) = maybe_item {
            let resolved = Symbol::new(&env, "resolved");
            if item.status == resolved {
                panic_with_error!(&env, LostFoundError::AlreadyResolved);
            }
            if item.is_claimed {
                panic_with_error!(&env, LostFoundError::AlreadyClaimed);
            }

            item.claimant = claimant;
            item.is_claimed = true;
            item.status = Symbol::new(&env, "claimed");
            env.storage().instance().set(&key, &item);
        } else {
            panic_with_error!(&env, LostFoundError::NotFound);
        }
    }

    pub fn mark_resolved(env: Env, id: Symbol, reporter: Address) {
        reporter.require_auth();

        let key = Self::item_key(&id);
        let maybe_item: Option<Item> = env.storage().instance().get(&key);

        if let Some(mut item) = maybe_item {
            if item.reporter != reporter {
                panic_with_error!(&env, LostFoundError::Unauthorized);
            }

            let resolved = Symbol::new(&env, "resolved");
            if item.status == resolved {
                panic_with_error!(&env, LostFoundError::AlreadyResolved);
            }

            item.status = resolved;
            item.resolved_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &item);

            let open_count: u32 = env.storage().instance().get(&Self::open_count_key()).unwrap_or(0);
            if open_count > 0 {
                env.storage().instance().set(&Self::open_count_key(), &(open_count - 1));
            }
        } else {
            panic_with_error!(&env, LostFoundError::NotFound);
        }
    }

    pub fn get_item(env: Env, id: Symbol) -> Option<Item> {
        env.storage().instance().get(&Self::item_key(&id))
    }

    pub fn list_items(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_open_count(env: Env) -> u32 {
        env.storage().instance().get(&Self::open_count_key()).unwrap_or(0)
    }
}
