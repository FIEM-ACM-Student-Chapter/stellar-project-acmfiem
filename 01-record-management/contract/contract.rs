#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Record {
    pub owner: Address,
    pub title: String,
    pub category: Symbol,
    pub description: String,
    pub archived: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum RecordDataKey {
    IdList,
    Record(Symbol),
    Count,
    CategoryIndex(Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RecordError {
    InvalidTitle = 1,
    InvalidTimestamp = 2,
    NotFound = 3,
    AlreadyExists = 4,
    Unauthorized = 5,
    AlreadyArchived = 6,
}

#[contract]
pub struct RecordManagementContract;

#[contractimpl]
impl RecordManagementContract {
    fn record_key(id: &Symbol) -> RecordDataKey {
        RecordDataKey::Record(id.clone())
    }

    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool {
        for current in ids.iter() {
            if current == id.clone() {
                return true;
            }
        }
        false
    }

    fn load_ids(env: &Env) -> Vec<Symbol> {
        env.storage().instance().get(&RecordDataKey::IdList).unwrap_or(Vec::new(env))
    }

    fn save_ids(env: &Env, ids: &Vec<Symbol>) {
        env.storage().instance().set(&RecordDataKey::IdList, ids);
    }

    fn load_category_ids(env: &Env, category: &Symbol) -> Vec<Symbol> {
        env.storage().instance().get(&RecordDataKey::CategoryIndex(category.clone())).unwrap_or(Vec::new(env))
    }

    fn save_category_ids(env: &Env, category: &Symbol, ids: &Vec<Symbol>) {
        env.storage().instance().set(&RecordDataKey::CategoryIndex(category.clone()), ids);
    }

    pub fn create_record(
        env: Env,
        id: Symbol,
        owner: Address,
        title: String,
        category: Symbol,
        description: String,
        created_at: u64,
    ) {
        owner.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, RecordError::InvalidTitle);
        }
        if created_at == 0 {
            panic_with_error!(&env, RecordError::InvalidTimestamp);
        }

        let key = Self::record_key(&id);
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, RecordError::AlreadyExists);
        }

        let record = Record {
            owner,
            title,
            category: category.clone(),
            description,
            archived: false,
            created_at,
            updated_at: created_at,
        };

        env.storage().instance().set(&key, &record);

        let mut ids = Self::load_ids(&env);
        ids.push_back(id.clone());
        Self::save_ids(&env, &ids);

        let mut cat_ids = Self::load_category_ids(&env, &category);
        cat_ids.push_back(id);
        Self::save_category_ids(&env, &category, &cat_ids);

        let count: u32 = env.storage().instance().get(&RecordDataKey::Count).unwrap_or(0);
        env.storage().instance().set(&RecordDataKey::Count, &(count + 1));
    }

    pub fn update_record(
        env: Env,
        id: Symbol,
        owner: Address,
        title: String,
        category: Symbol,
        description: String,
        updated_at: u64,
    ) {
        owner.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, RecordError::InvalidTitle);
        }
        if updated_at == 0 {
            panic_with_error!(&env, RecordError::InvalidTimestamp);
        }

        let key = Self::record_key(&id);
        let maybe: Option<Record> = env.storage().instance().get(&key);

        if let Some(mut record) = maybe {
            if record.owner != owner {
                panic_with_error!(&env, RecordError::Unauthorized);
            }

            record.title = title;
            record.category = category;
            record.description = description;
            record.updated_at = updated_at;

            env.storage().instance().set(&key, &record);
        } else {
            panic_with_error!(&env, RecordError::NotFound);
        }
    }

    pub fn archive_record(env: Env, id: Symbol, owner: Address) {
        owner.require_auth();

        let key = Self::record_key(&id);
        let maybe: Option<Record> = env.storage().instance().get(&key);

        if let Some(mut record) = maybe {
            if record.owner != owner {
                panic_with_error!(&env, RecordError::Unauthorized);
            }
            if record.archived {
                panic_with_error!(&env, RecordError::AlreadyArchived);
            }

            record.archived = true;
            env.storage().instance().set(&key, &record);
        } else {
            panic_with_error!(&env, RecordError::NotFound);
        }
    }

    pub fn get_record(env: Env, id: Symbol) -> Option<Record> {
        env.storage().instance().get(&Self::record_key(&id))
    }

    pub fn list_records(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_records_by_category(env: Env, category: Symbol) -> Vec<Symbol> {
        Self::load_category_ids(&env, &category)
    }

    pub fn get_count(env: Env) -> u32 {
        env.storage().instance().get(&RecordDataKey::Count).unwrap_or(0)
    }
}
