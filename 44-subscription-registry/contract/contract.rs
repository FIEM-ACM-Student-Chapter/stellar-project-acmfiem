#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Subscription {
    pub subscriber: Address,
    pub plan_name: String,
    pub billing_cycle: Symbol,
    pub fee: i128,
    pub status: Symbol,
    pub renewals: u32,
    pub created_at: u64,
    pub renewed_at: u64,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum SubscriptionDataKey {
    IdList,
    Subscription(Symbol),
    ActiveCount,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SubscriptionError {
    InvalidPlan = 1,
    InvalidAmount = 2,
    InvalidTimestamp = 3,
    NotFound = 4,
    Unauthorized = 5,
    AlreadyExists = 6,
    AlreadyCancelled = 7,
}

#[contract]
pub struct SubscriptionRegistryContract;

#[contractimpl]
impl SubscriptionRegistryContract {
    fn ids_key() -> SubscriptionDataKey {
        SubscriptionDataKey::IdList
    }

    fn subscription_key(id: &Symbol) -> SubscriptionDataKey {
        SubscriptionDataKey::Subscription(id.clone())
    }

    fn active_count_key() -> SubscriptionDataKey {
        SubscriptionDataKey::ActiveCount
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

    pub fn create_subscription(
        env: Env,
        id: Symbol,
        subscriber: Address,
        plan_name: String,
        billing_cycle: Symbol,
        fee: i128,
        created_at: u64,
        expires_at: u64,
    ) {
        subscriber.require_auth();

        if plan_name.len() == 0 {
            panic_with_error!(&env, SubscriptionError::InvalidPlan);
        }
        if fee <= 0 {
            panic_with_error!(&env, SubscriptionError::InvalidAmount);
        }
        if created_at == 0 || expires_at == 0 {
            panic_with_error!(&env, SubscriptionError::InvalidTimestamp);
        }

        let key = Self::subscription_key(&id);
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, SubscriptionError::AlreadyExists);
        }

        let subscription = Subscription {
            subscriber,
            plan_name,
            billing_cycle,
            fee,
            status: Symbol::new(&env, "active"),
            renewals: 0,
            created_at,
            renewed_at: created_at,
            expires_at,
        };

        env.storage().instance().set(&key, &subscription);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }

        let count: u32 = env.storage().instance().get(&Self::active_count_key()).unwrap_or(0);
        env.storage().instance().set(&Self::active_count_key(), &(count + 1));
    }

    pub fn renew_subscription(env: Env, id: Symbol, subscriber: Address, new_expiry: u64) {
        subscriber.require_auth();

        if new_expiry == 0 {
            panic_with_error!(&env, SubscriptionError::InvalidTimestamp);
        }

        let key = Self::subscription_key(&id);
        let maybe_subscription: Option<Subscription> = env.storage().instance().get(&key);

        if let Some(mut subscription) = maybe_subscription {
            if subscription.subscriber != subscriber {
                panic_with_error!(&env, SubscriptionError::Unauthorized);
            }

            let cancelled = Symbol::new(&env, "cancelled");
            let active = Symbol::new(&env, "active");
            if subscription.status == cancelled {
                panic_with_error!(&env, SubscriptionError::AlreadyCancelled);
            }

            if subscription.status != active {
                let count: u32 = env.storage().instance().get(&Self::active_count_key()).unwrap_or(0);
                env.storage().instance().set(&Self::active_count_key(), &(count + 1));
            }

            subscription.status = active;
            subscription.renewals += 1;
            subscription.renewed_at = env.ledger().timestamp();
            subscription.expires_at = new_expiry;
            env.storage().instance().set(&key, &subscription);
        } else {
            panic_with_error!(&env, SubscriptionError::NotFound);
        }
    }

    pub fn pause_subscription(env: Env, id: Symbol, subscriber: Address) {
        subscriber.require_auth();

        let key = Self::subscription_key(&id);
        let maybe_subscription: Option<Subscription> = env.storage().instance().get(&key);

        if let Some(mut subscription) = maybe_subscription {
            if subscription.subscriber != subscriber {
                panic_with_error!(&env, SubscriptionError::Unauthorized);
            }

            let active = Symbol::new(&env, "active");
            let cancelled = Symbol::new(&env, "cancelled");
            if subscription.status == cancelled {
                panic_with_error!(&env, SubscriptionError::AlreadyCancelled);
            }
            if subscription.status == active {
                let count: u32 = env.storage().instance().get(&Self::active_count_key()).unwrap_or(0);
                if count > 0 {
                    env.storage().instance().set(&Self::active_count_key(), &(count - 1));
                }
            }

            subscription.status = Symbol::new(&env, "paused");
            env.storage().instance().set(&key, &subscription);
        } else {
            panic_with_error!(&env, SubscriptionError::NotFound);
        }
    }

    pub fn cancel_subscription(env: Env, id: Symbol, subscriber: Address) {
        subscriber.require_auth();

        let key = Self::subscription_key(&id);
        let maybe_subscription: Option<Subscription> = env.storage().instance().get(&key);

        if let Some(mut subscription) = maybe_subscription {
            if subscription.subscriber != subscriber {
                panic_with_error!(&env, SubscriptionError::Unauthorized);
            }

            let cancelled = Symbol::new(&env, "cancelled");
            let active = Symbol::new(&env, "active");
            if subscription.status == cancelled {
                panic_with_error!(&env, SubscriptionError::AlreadyCancelled);
            }
            if subscription.status == active {
                let count: u32 = env.storage().instance().get(&Self::active_count_key()).unwrap_or(0);
                if count > 0 {
                    env.storage().instance().set(&Self::active_count_key(), &(count - 1));
                }
            }

            subscription.status = cancelled;
            env.storage().instance().set(&key, &subscription);
        } else {
            panic_with_error!(&env, SubscriptionError::NotFound);
        }
    }

    pub fn get_subscription(env: Env, id: Symbol) -> Option<Subscription> {
        env.storage().instance().get(&Self::subscription_key(&id))
    }

    pub fn list_subscriptions(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_active_count(env: Env) -> u32 {
        env.storage().instance().get(&Self::active_count_key()).unwrap_or(0)
    }
}

