#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Notice {
    pub author: Address,
    pub title: String,
    pub content: String,
    pub category: Symbol,
    pub priority: u32,
    pub pinned: bool,
    pub removed: bool,
    pub created_at: u64,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum NoticeDataKey {
    IdList,
    Notice(Symbol),
    Count,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum NoticeError {
    InvalidTitle = 1,
    InvalidTimestamp = 2,
    NotFound = 3,
    AlreadyExists = 4,
    Unauthorized = 5,
    AlreadyRemoved = 6,
}

#[contract]
pub struct NoticeBoardContract;

#[contractimpl]
impl NoticeBoardContract {
    fn notice_key(id: &Symbol) -> NoticeDataKey {
        NoticeDataKey::Notice(id.clone())
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
        env.storage().instance().get(&NoticeDataKey::IdList).unwrap_or(Vec::new(env))
    }

    fn save_ids(env: &Env, ids: &Vec<Symbol>) {
        env.storage().instance().set(&NoticeDataKey::IdList, ids);
    }

    pub fn post_notice(
        env: Env,
        id: Symbol,
        author: Address,
        title: String,
        content: String,
        category: Symbol,
        priority: u32,
        expires_at: u64,
    ) {
        author.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, NoticeError::InvalidTitle);
        }
        if expires_at == 0 {
            panic_with_error!(&env, NoticeError::InvalidTimestamp);
        }

        let key = Self::notice_key(&id);
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, NoticeError::AlreadyExists);
        }

        let notice = Notice {
            author,
            title,
            content,
            category,
            priority,
            pinned: false,
            removed: false,
            created_at: expires_at,
            expires_at,
        };

        env.storage().instance().set(&key, &notice);

        let mut ids = Self::load_ids(&env);
        ids.push_back(id);
        Self::save_ids(&env, &ids);

        let count: u32 = env.storage().instance().get(&NoticeDataKey::Count).unwrap_or(0);
        env.storage().instance().set(&NoticeDataKey::Count, &(count + 1));
    }

    pub fn edit_notice(
        env: Env,
        id: Symbol,
        author: Address,
        title: String,
        content: String,
        category: Symbol,
        priority: u32,
    ) {
        author.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, NoticeError::InvalidTitle);
        }

        let key = Self::notice_key(&id);
        let maybe: Option<Notice> = env.storage().instance().get(&key);

        if let Some(mut notice) = maybe {
            if notice.author != author {
                panic_with_error!(&env, NoticeError::Unauthorized);
            }
            if notice.removed {
                panic_with_error!(&env, NoticeError::AlreadyRemoved);
            }

            notice.title = title;
            notice.content = content;
            notice.category = category;
            notice.priority = priority;

            env.storage().instance().set(&key, &notice);
        } else {
            panic_with_error!(&env, NoticeError::NotFound);
        }
    }

    pub fn remove_notice(env: Env, id: Symbol, author: Address) {
        author.require_auth();

        let key = Self::notice_key(&id);
        let maybe: Option<Notice> = env.storage().instance().get(&key);

        if let Some(mut notice) = maybe {
            if notice.author != author {
                panic_with_error!(&env, NoticeError::Unauthorized);
            }
            if notice.removed {
                panic_with_error!(&env, NoticeError::AlreadyRemoved);
            }

            notice.removed = true;
            env.storage().instance().set(&key, &notice);
        } else {
            panic_with_error!(&env, NoticeError::NotFound);
        }
    }

    pub fn pin_notice(env: Env, id: Symbol, author: Address) {
        author.require_auth();

        let key = Self::notice_key(&id);
        let maybe: Option<Notice> = env.storage().instance().get(&key);

        if let Some(mut notice) = maybe {
            if notice.author != author {
                panic_with_error!(&env, NoticeError::Unauthorized);
            }
            if notice.removed {
                panic_with_error!(&env, NoticeError::AlreadyRemoved);
            }

            notice.pinned = !notice.pinned;
            env.storage().instance().set(&key, &notice);
        } else {
            panic_with_error!(&env, NoticeError::NotFound);
        }
    }

    pub fn get_notice(env: Env, id: Symbol) -> Option<Notice> {
        env.storage().instance().get(&Self::notice_key(&id))
    }

    pub fn list_notices(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_notice_count(env: Env) -> u32 {
        env.storage().instance().get(&NoticeDataKey::Count).unwrap_or(0)
    }
}
