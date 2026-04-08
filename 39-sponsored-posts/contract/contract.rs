#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Ad {
    pub advertiser: Address,
    pub publisher: Address,
    pub title: String,
    pub content: String,
    pub target_audience: Symbol,
    pub budget: i128,
    pub spent: i128,
    pub cost_per_view: i128,
    pub view_count: u32,
    pub status: Symbol,
    pub is_approved: bool,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum AdDataKey {
    AdList,
    Ad(Symbol),
    AdCount,
    Viewed(Symbol, Address),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AdError {
    TitleEmpty = 1,
    InvalidBudget = 2,
    AdNotFound = 3,
    NotAdvertiser = 4,
    NotApproved = 5,
    BudgetExhausted = 6,
    InvalidCostPerView = 7,
    AdNotActive = 8,
    AlreadyViewed = 9,
}

#[contract]
pub struct SponsoredPostsContract;

#[contractimpl]
impl SponsoredPostsContract {
    fn ad_key(id: &Symbol) -> AdDataKey {
        AdDataKey::Ad(id.clone())
    }

    fn list_key() -> AdDataKey {
        AdDataKey::AdList
    }

    fn count_key() -> AdDataKey {
        AdDataKey::AdCount
    }

    fn viewed_key(ad_id: &Symbol, viewer: &Address) -> AdDataKey {
        AdDataKey::Viewed(ad_id.clone(), viewer.clone())
    }

    fn load_ids(env: &Env) -> Vec<Symbol> {
        env.storage().instance().get(&Self::list_key()).unwrap_or(Vec::new(env))
    }

    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool {
        for current in ids.iter() {
            if current == id.clone() {
                return true;
            }
        }
        false
    }

    pub fn create_ad(
        env: Env,
        id: Symbol,
        advertiser: Address,
        title: String,
        content: String,
        target_audience: Symbol,
        budget: i128,
        cost_per_view: i128,
    ) {
        advertiser.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, AdError::TitleEmpty);
        }
        if budget <= 0 {
            panic_with_error!(&env, AdError::InvalidBudget);
        }
        if cost_per_view <= 0 {
            panic_with_error!(&env, AdError::InvalidCostPerView);
        }

        let ad = Ad {
            advertiser,
            publisher: env.current_contract_address(),
            title,
            content,
            target_audience,
            budget,
            spent: 0,
            cost_per_view,
            view_count: 0,
            status: Symbol::new(&env, "pending"),
            is_approved: false,
            created_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&Self::ad_key(&id), &ad);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            env.storage().instance().set(&Self::list_key(), &ids);
            let count: u32 = env.storage().instance().get(&Self::count_key()).unwrap_or(0);
            env.storage().instance().set(&Self::count_key(), &(count + 1));
        }
    }

    pub fn approve_ad(env: Env, id: Symbol, publisher: Address) {
        publisher.require_auth();

        let key = Self::ad_key(&id);
        let maybe_ad: Option<Ad> = env.storage().instance().get(&key);
        if maybe_ad.is_none() {
            panic_with_error!(&env, AdError::AdNotFound);
        }
        let mut ad = maybe_ad.unwrap();

        ad.publisher = publisher;
        ad.is_approved = true;
        ad.status = Symbol::new(&env, "active");
        env.storage().instance().set(&key, &ad);
    }

    pub fn record_view(env: Env, id: Symbol, viewer: Address) {
        viewer.require_auth();

        let key = Self::ad_key(&id);
        let maybe_ad: Option<Ad> = env.storage().instance().get(&key);
        if maybe_ad.is_none() {
            panic_with_error!(&env, AdError::AdNotFound);
        }
        let mut ad = maybe_ad.unwrap();

        if !ad.is_approved {
            panic_with_error!(&env, AdError::NotApproved);
        }

        let active = Symbol::new(&env, "active");
        if ad.status != active {
            panic_with_error!(&env, AdError::AdNotActive);
        }

        let vk = Self::viewed_key(&id, &viewer);
        let already: bool = env.storage().instance().get(&vk).unwrap_or(false);
        if already {
            panic_with_error!(&env, AdError::AlreadyViewed);
        }

        let remaining = ad.budget - ad.spent;
        if remaining < ad.cost_per_view {
            panic_with_error!(&env, AdError::BudgetExhausted);
        }

        ad.spent += ad.cost_per_view;
        ad.view_count += 1;

        if ad.spent >= ad.budget {
            ad.status = Symbol::new(&env, "exhausted");
        }

        env.storage().instance().set(&key, &ad);
        env.storage().instance().set(&vk, &true);
    }

    pub fn pause_ad(env: Env, id: Symbol, advertiser: Address) {
        advertiser.require_auth();

        let key = Self::ad_key(&id);
        let maybe_ad: Option<Ad> = env.storage().instance().get(&key);
        if maybe_ad.is_none() {
            panic_with_error!(&env, AdError::AdNotFound);
        }
        let mut ad = maybe_ad.unwrap();

        ad.status = Symbol::new(&env, "paused");
        env.storage().instance().set(&key, &ad);
    }

    pub fn resume_ad(env: Env, id: Symbol, advertiser: Address) {
        advertiser.require_auth();

        let key = Self::ad_key(&id);
        let maybe_ad: Option<Ad> = env.storage().instance().get(&key);
        if maybe_ad.is_none() {
            panic_with_error!(&env, AdError::AdNotFound);
        }
        let mut ad = maybe_ad.unwrap();

        ad.status = Symbol::new(&env, "active");
        env.storage().instance().set(&key, &ad);
    }

    pub fn get_ad(env: Env, id: Symbol) -> Option<Ad> {
        env.storage().instance().get(&Self::ad_key(&id))
    }

    pub fn list_ads(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_ad_count(env: Env) -> u32 {
        env.storage().instance().get(&Self::count_key()).unwrap_or(0)
    }
}
