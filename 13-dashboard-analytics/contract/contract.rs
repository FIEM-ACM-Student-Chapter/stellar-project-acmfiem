#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Metric {
    pub reporter: Address,
    pub metric_name: String,
    pub value: i128,
    pub category: Symbol,
    pub event_type: Symbol,
    pub description: String,
    pub recorded_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    MetricList,
    Metric(Symbol),
    MetricCount,
    CategoryTotal(Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AnalyticsError {
    MetricNotFound = 1,
    MetricAlreadyExists = 2,
    NotReporter = 3,
    InvalidMetricName = 4,
    InvalidTimestamp = 5,
}

#[contract]
pub struct DashboardAnalyticsContract;

#[contractimpl]
impl DashboardAnalyticsContract {
    fn load_ids(env: &Env) -> Vec<Symbol> {
        env.storage()
            .instance()
            .get(&DataKey::MetricList)
            .unwrap_or(Vec::new(env))
    }

    fn save_ids(env: &Env, ids: &Vec<Symbol>) {
        env.storage().instance().set(&DataKey::MetricList, ids);
    }

    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool {
        for current in ids.iter() {
            if current == id.clone() {
                return true;
            }
        }
        false
    }

    fn increment_count(env: &Env) {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MetricCount)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::MetricCount, &(count + 1));
    }

    pub fn record_metric(
        env: Env,
        id: Symbol,
        reporter: Address,
        metric_name: String,
        value: i128,
        category: Symbol,
        timestamp: u64,
    ) {
        reporter.require_auth();

        if metric_name.len() == 0 {
            panic_with_error!(env, AnalyticsError::InvalidMetricName);
        }
        if timestamp == 0 {
            panic_with_error!(env, AnalyticsError::InvalidTimestamp);
        }

        let key = DataKey::Metric(id.clone());
        if env.storage().instance().has(&key) {
            panic_with_error!(env, AnalyticsError::MetricAlreadyExists);
        }

        let metric = Metric {
            reporter,
            metric_name,
            value,
            category: category.clone(),
            event_type: Symbol::new(&env, "metric"),
            description: String::from_str(&env, ""),
            recorded_at: timestamp,
            updated_at: timestamp,
        };

        env.storage().instance().set(&key, &metric);

        let cat_key = DataKey::CategoryTotal(category);
        let cat_total: i128 = env.storage().instance().get(&cat_key).unwrap_or(0);
        env.storage().instance().set(&cat_key, &(cat_total + value));

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
            Self::increment_count(&env);
        }
    }

    pub fn update_metric(
        env: Env,
        id: Symbol,
        reporter: Address,
        new_value: i128,
        timestamp: u64,
    ) {
        reporter.require_auth();

        if timestamp == 0 {
            panic_with_error!(env, AnalyticsError::InvalidTimestamp);
        }

        let key = DataKey::Metric(id.clone());
        let mut metric: Metric = env
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, AnalyticsError::MetricNotFound));

        if metric.reporter != reporter {
            panic_with_error!(env, AnalyticsError::NotReporter);
        }

        let old_value = metric.value;
        let cat_key = DataKey::CategoryTotal(metric.category.clone());
        let cat_total: i128 = env.storage().instance().get(&cat_key).unwrap_or(0);
        env.storage()
            .instance()
            .set(&cat_key, &(cat_total - old_value + new_value));

        metric.value = new_value;
        metric.updated_at = timestamp;
        env.storage().instance().set(&key, &metric);
    }

    pub fn record_event(
        env: Env,
        id: Symbol,
        reporter: Address,
        event_type: Symbol,
        description: String,
        timestamp: u64,
    ) {
        reporter.require_auth();

        if timestamp == 0 {
            panic_with_error!(env, AnalyticsError::InvalidTimestamp);
        }

        let key = DataKey::Metric(id.clone());
        if env.storage().instance().has(&key) {
            panic_with_error!(env, AnalyticsError::MetricAlreadyExists);
        }

        let metric = Metric {
            reporter,
            metric_name: String::from_str(&env, "event"),
            value: 0,
            category: Symbol::new(&env, "events"),
            event_type,
            description,
            recorded_at: timestamp,
            updated_at: timestamp,
        };

        env.storage().instance().set(&key, &metric);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
            Self::increment_count(&env);
        }
    }

    pub fn get_metric(env: Env, id: Symbol) -> Option<Metric> {
        env.storage().instance().get(&DataKey::Metric(id))
    }

    pub fn list_metrics(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_category_total(env: Env, category: Symbol) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::CategoryTotal(category))
            .unwrap_or(0)
    }

    pub fn get_metric_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::MetricCount)
            .unwrap_or(0)
    }
}
