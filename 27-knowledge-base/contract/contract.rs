#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Article {
    pub author: Address,
    pub last_editor: Address,
    pub title: String,
    pub content: String,
    pub category: Symbol,
    pub tags: String,
    pub version: u32,
    pub upvotes: u32,
    pub is_answer: bool,
    pub is_archived: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IdList,
    Article(Symbol),
    Count,
    Upvoted(Symbol, Address),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    NotFound = 1,
    NotAuthorized = 2,
    InvalidTitle = 3,
    AlreadyUpvoted = 4,
    AlreadyArchived = 5,
}

#[contract]
pub struct KnowledgeBaseContract;

#[contractimpl]
impl KnowledgeBaseContract {
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

    pub fn create_article(
        env: Env,
        id: Symbol,
        author: Address,
        title: String,
        content: String,
        category: Symbol,
        tags: String,
    ) {
        author.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, ContractError::InvalidTitle);
        }

        let now = env.ledger().timestamp();

        let article = Article {
            author: author.clone(),
            last_editor: author,
            title,
            content,
            category,
            tags,
            version: 1,
            upvotes: 0,
            is_answer: false,
            is_archived: false,
            created_at: now,
            updated_at: now,
        };

        let key = DataKey::Article(id.clone());
        let exists = env.storage().instance().has(&key);
        env.storage().instance().set(&key, &article);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
            if !exists {
                let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
                env.storage().instance().set(&DataKey::Count, &(count + 1));
            }
        }
    }

    pub fn edit_article(env: Env, id: Symbol, editor: Address, new_content: String) {
        editor.require_auth();

        let key = DataKey::Article(id.clone());
        let mut article: Article = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotFound));

        if article.is_archived {
            panic_with_error!(&env, ContractError::AlreadyArchived);
        }

        let now = env.ledger().timestamp();
        article.last_editor = editor;
        article.content = new_content;
        article.version += 1;
        article.updated_at = now;

        env.storage().instance().set(&key, &article);
    }

    pub fn upvote_article(env: Env, id: Symbol, voter: Address) {
        voter.require_auth();

        let vote_key = DataKey::Upvoted(id.clone(), voter.clone());
        if env.storage().instance().has(&vote_key) {
            panic_with_error!(&env, ContractError::AlreadyUpvoted);
        }

        let key = DataKey::Article(id.clone());
        let mut article: Article = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotFound));

        article.upvotes += 1;
        env.storage().instance().set(&key, &article);
        env.storage().instance().set(&vote_key, &true);
    }

    pub fn mark_answer(env: Env, id: Symbol, author: Address) {
        author.require_auth();

        let key = DataKey::Article(id.clone());
        let mut article: Article = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotFound));

        if article.author != author {
            panic_with_error!(&env, ContractError::NotAuthorized);
        }

        article.is_answer = true;
        env.storage().instance().set(&key, &article);
    }

    pub fn archive_article(env: Env, id: Symbol, author: Address) {
        author.require_auth();

        let key = DataKey::Article(id.clone());
        let mut article: Article = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotFound));

        if article.author != author {
            panic_with_error!(&env, ContractError::NotAuthorized);
        }

        article.is_archived = true;
        let now = env.ledger().timestamp();
        article.updated_at = now;
        env.storage().instance().set(&key, &article);
    }

    pub fn get_article(env: Env, id: Symbol) -> Option<Article> {
        env.storage().instance().get(&DataKey::Article(id))
    }

    pub fn list_articles(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_article_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }
}
