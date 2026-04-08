#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Content {
    pub creator: Address,
    pub title: String,
    pub preview: String,
    pub content_hash: String,
    pub price: i128,
    pub total_sales: u32,
    pub total_earned: i128,
    pub withdrawn: i128,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IdList,
    Content(Symbol),
    Count,
    Purchase(Symbol, Address),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    NotFound = 1,
    NotAuthorized = 2,
    InvalidTitle = 3,
    InsufficientPayment = 4,
    AlreadyPurchased = 5,
    NothingToWithdraw = 6,
    InvalidPrice = 7,
}

#[contract]
pub struct PayToUnlockContract;

#[contractimpl]
impl PayToUnlockContract {
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

    pub fn create_content(
        env: Env,
        id: Symbol,
        creator: Address,
        title: String,
        preview: String,
        content_hash: String,
        price: i128,
    ) {
        creator.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, ContractError::InvalidTitle);
        }
        if price < 0 {
            panic_with_error!(&env, ContractError::InvalidPrice);
        }

        let now = env.ledger().timestamp();

        let content = Content {
            creator,
            title,
            preview,
            content_hash,
            price,
            total_sales: 0,
            total_earned: 0,
            withdrawn: 0,
            created_at: now,
        };

        let key = DataKey::Content(id.clone());
        let exists = env.storage().instance().has(&key);
        env.storage().instance().set(&key, &content);

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

    pub fn purchase_content(
        env: Env,
        content_id: Symbol,
        buyer: Address,
        payment_amount: i128,
    ) {
        buyer.require_auth();

        let key = DataKey::Content(content_id.clone());
        let mut content: Content = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotFound));

        let purchase_key = DataKey::Purchase(content_id.clone(), buyer.clone());
        if env.storage().instance().has(&purchase_key) {
            panic_with_error!(&env, ContractError::AlreadyPurchased);
        }

        if payment_amount < content.price {
            panic_with_error!(&env, ContractError::InsufficientPayment);
        }

        env.storage().instance().set(&purchase_key, &true);
        content.total_sales += 1;
        content.total_earned += payment_amount;
        env.storage().instance().set(&key, &content);
    }

    pub fn has_access(env: Env, content_id: Symbol, user: Address) -> bool {
        let purchase_key = DataKey::Purchase(content_id.clone(), user.clone());
        if env.storage().instance().has(&purchase_key) {
            return true;
        }
        let key = DataKey::Content(content_id);
        let content: Option<Content> = env.storage().instance().get(&key);
        match content {
            Some(c) => c.creator == user,
            None => false,
        }
    }

    pub fn update_price(env: Env, id: Symbol, creator: Address, new_price: i128) {
        creator.require_auth();

        if new_price < 0 {
            panic_with_error!(&env, ContractError::InvalidPrice);
        }

        let key = DataKey::Content(id.clone());
        let mut content: Content = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotFound));

        if content.creator != creator {
            panic_with_error!(&env, ContractError::NotAuthorized);
        }

        content.price = new_price;
        env.storage().instance().set(&key, &content);
    }

    pub fn withdraw_earnings(env: Env, id: Symbol, creator: Address) -> i128 {
        creator.require_auth();

        let key = DataKey::Content(id.clone());
        let mut content: Content = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotFound));

        if content.creator != creator {
            panic_with_error!(&env, ContractError::NotAuthorized);
        }

        let available = content.total_earned - content.withdrawn;
        if available <= 0 {
            panic_with_error!(&env, ContractError::NothingToWithdraw);
        }

        content.withdrawn = content.total_earned;
        env.storage().instance().set(&key, &content);

        available
    }

    pub fn get_content(env: Env, id: Symbol) -> Option<Content> {
        env.storage().instance().get(&DataKey::Content(id))
    }

    pub fn list_content(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_content_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }
}
