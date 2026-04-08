#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Post {
    pub author: Address,
    pub content: String,
    pub category: Symbol,
    pub tags: String,
    pub like_count: u32,
    pub comment_count: u32,
    pub flag_count: u32,
    pub is_removed: bool,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IdList,
    Post(Symbol),
    Count,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CommunityError {
    NotFound = 1,
    NotAuthor = 2,
    AlreadyExists = 3,
    InvalidContent = 4,
    PostRemoved = 5,
}

#[contract]
pub struct CommunityPlatformContract;

#[contractimpl]
impl CommunityPlatformContract {
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

    pub fn create_post(
        env: Env,
        id: Symbol,
        author: Address,
        content: String,
        category: Symbol,
        tags: String,
    ) {
        author.require_auth();

        if content.len() == 0 {
            panic_with_error!(&env, CommunityError::InvalidContent);
        }

        let key = DataKey::Post(id.clone());
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, CommunityError::AlreadyExists);
        }

        let post = Post {
            author,
            content,
            category,
            tags,
            like_count: 0,
            comment_count: 0,
            flag_count: 0,
            is_removed: false,
            created_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&key, &post);

        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        env.storage().instance().set(&DataKey::Count, &(count + 1));

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn like_post(env: Env, id: Symbol, liker: Address) {
        liker.require_auth();

        let key = DataKey::Post(id.clone());
        let maybe: Option<Post> = env.storage().instance().get(&key);

        if let Some(mut post) = maybe {
            if post.is_removed {
                panic_with_error!(&env, CommunityError::PostRemoved);
            }
            post.like_count += 1;
            env.storage().instance().set(&key, &post);
        } else {
            panic_with_error!(&env, CommunityError::NotFound);
        }
    }

    pub fn comment_post(env: Env, id: Symbol, commenter: Address, _comment_text: String) {
        commenter.require_auth();

        let key = DataKey::Post(id.clone());
        let maybe: Option<Post> = env.storage().instance().get(&key);

        if let Some(mut post) = maybe {
            if post.is_removed {
                panic_with_error!(&env, CommunityError::PostRemoved);
            }
            post.comment_count += 1;
            env.storage().instance().set(&key, &post);
        } else {
            panic_with_error!(&env, CommunityError::NotFound);
        }
    }

    pub fn flag_post(env: Env, id: Symbol, flagger: Address) {
        flagger.require_auth();

        let key = DataKey::Post(id.clone());
        let maybe: Option<Post> = env.storage().instance().get(&key);

        if let Some(mut post) = maybe {
            if post.is_removed {
                panic_with_error!(&env, CommunityError::PostRemoved);
            }
            post.flag_count += 1;
            env.storage().instance().set(&key, &post);
        } else {
            panic_with_error!(&env, CommunityError::NotFound);
        }
    }

    pub fn remove_post(env: Env, id: Symbol, author: Address) {
        author.require_auth();

        let key = DataKey::Post(id.clone());
        let maybe: Option<Post> = env.storage().instance().get(&key);

        if let Some(mut post) = maybe {
            if post.author != author {
                panic_with_error!(&env, CommunityError::NotAuthor);
            }
            post.is_removed = true;
            env.storage().instance().set(&key, &post);
        } else {
            panic_with_error!(&env, CommunityError::NotFound);
        }
    }

    pub fn get_post(env: Env, id: Symbol) -> Option<Post> {
        env.storage().instance().get(&DataKey::Post(id))
    }

    pub fn list_posts(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_post_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }
}
