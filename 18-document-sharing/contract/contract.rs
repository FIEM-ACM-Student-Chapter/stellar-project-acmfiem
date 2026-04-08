#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Document {
    pub owner: Address,
    pub title: String,
    pub doc_hash: String,
    pub doc_type: Symbol,
    pub file_size: u32,
    pub version: u32,
    pub share_count: u32,
    pub is_public: bool,
    pub uploaded_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IdList,
    Doc(Symbol),
    Access(Symbol, Address),
    Count,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum DocError {
    NotFound = 1,
    NotOwner = 2,
    AlreadyExists = 3,
    InvalidTitle = 4,
    InvalidHash = 5,
    InvalidSize = 6,
}

#[contract]
pub struct DocumentSharingContract;

#[contractimpl]
impl DocumentSharingContract {
    fn load_ids(env: &Env) -> Vec<Symbol> {
        env.storage().instance().get(&DataKey::IdList).unwrap_or(Vec::new(env))
    }

    fn save_ids(env: &Env, ids: &Vec<Symbol>) {
        env.storage().instance().set(&DataKey::IdList, ids);
    }

    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool {
        for current in ids.iter() {
            if current == id.clone() {
                return true;
            }
        }
        false
    }

    pub fn upload_doc(
        env: Env,
        id: Symbol,
        owner: Address,
        title: String,
        doc_hash: String,
        doc_type: Symbol,
        file_size: u32,
    ) {
        owner.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, DocError::InvalidTitle);
        }
        if doc_hash.len() == 0 {
            panic_with_error!(&env, DocError::InvalidHash);
        }
        if file_size == 0 {
            panic_with_error!(&env, DocError::InvalidSize);
        }

        let key = DataKey::Doc(id.clone());
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, DocError::AlreadyExists);
        }

        let now = env.ledger().timestamp();
        let doc = Document {
            owner,
            title,
            doc_hash,
            doc_type,
            file_size,
            version: 1,
            share_count: 0,
            is_public: false,
            uploaded_at: now,
            updated_at: now,
        };

        env.storage().instance().set(&key, &doc);

        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        env.storage().instance().set(&DataKey::Count, &(count + 1));

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn share_doc(env: Env, id: Symbol, owner: Address, shared_with: Address) {
        owner.require_auth();

        let key = DataKey::Doc(id.clone());
        let maybe: Option<Document> = env.storage().instance().get(&key);

        if let Some(mut doc) = maybe {
            if doc.owner != owner {
                panic_with_error!(&env, DocError::NotOwner);
            }
            let access_key = DataKey::Access(id, shared_with);
            env.storage().instance().set(&access_key, &true);
            doc.share_count += 1;
            env.storage().instance().set(&key, &doc);
        } else {
            panic_with_error!(&env, DocError::NotFound);
        }
    }

    pub fn revoke_access(env: Env, id: Symbol, owner: Address, revoked_from: Address) {
        owner.require_auth();

        let key = DataKey::Doc(id.clone());
        let maybe: Option<Document> = env.storage().instance().get(&key);

        if let Some(mut doc) = maybe {
            if doc.owner != owner {
                panic_with_error!(&env, DocError::NotOwner);
            }
            let access_key = DataKey::Access(id, revoked_from);
            env.storage().instance().set(&access_key, &false);
            if doc.share_count > 0 {
                doc.share_count -= 1;
            }
            env.storage().instance().set(&key, &doc);
        } else {
            panic_with_error!(&env, DocError::NotFound);
        }
    }

    pub fn update_doc(env: Env, id: Symbol, owner: Address, new_hash: String, new_size: u32) {
        owner.require_auth();

        if new_hash.len() == 0 {
            panic_with_error!(&env, DocError::InvalidHash);
        }
        if new_size == 0 {
            panic_with_error!(&env, DocError::InvalidSize);
        }

        let key = DataKey::Doc(id.clone());
        let maybe: Option<Document> = env.storage().instance().get(&key);

        if let Some(mut doc) = maybe {
            if doc.owner != owner {
                panic_with_error!(&env, DocError::NotOwner);
            }
            doc.doc_hash = new_hash;
            doc.file_size = new_size;
            doc.version += 1;
            doc.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &doc);
        } else {
            panic_with_error!(&env, DocError::NotFound);
        }
    }

    pub fn get_doc(env: Env, id: Symbol) -> Option<Document> {
        env.storage().instance().get(&DataKey::Doc(id))
    }

    pub fn list_docs(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_doc_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }
}
