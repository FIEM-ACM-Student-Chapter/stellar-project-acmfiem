#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct GeoAlert {
    pub creator: Address,
    pub title: String,
    pub description: String,
    pub alert_type: Symbol,
    pub latitude: i128,
    pub longitude: i128,
    pub radius: u32,
    pub severity: u32,
    pub acknowledged_by: Address,
    pub status: Symbol,
    pub created_at: u64,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum GeoAlertDataKey {
    IdList,
    Item(Symbol),
    ActiveCount,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum GeoAlertError {
    InvalidTitle = 1,
    InvalidTimestamp = 2,
    NotFound = 3,
    NotCreator = 4,
    AlreadyResolved = 5,
    InvalidSeverity = 6,
    MaxSeverity = 7,
}

#[contract]
pub struct GeoAlertContract;

#[contractimpl]
impl GeoAlertContract {
    fn ids_key() -> GeoAlertDataKey {
        GeoAlertDataKey::IdList
    }

    fn item_key(id: &Symbol) -> GeoAlertDataKey {
        GeoAlertDataKey::Item(id.clone())
    }

    fn active_count_key() -> GeoAlertDataKey {
        GeoAlertDataKey::ActiveCount
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

    fn get_active_count_val(env: &Env) -> u32 {
        env.storage().instance().get(&Self::active_count_key()).unwrap_or(0)
    }

    fn set_active_count(env: &Env, count: u32) {
        env.storage().instance().set(&Self::active_count_key(), &count);
    }

    pub fn create_alert(
        env: Env,
        id: Symbol,
        creator: Address,
        title: String,
        description: String,
        alert_type: Symbol,
        latitude: i128,
        longitude: i128,
        radius: u32,
        severity: u32,
        expires_at: u64,
    ) {
        creator.require_auth();

        if title.len() == 0 {
            panic_with_error!(env, GeoAlertError::InvalidTitle);
        }
        if severity > 5 {
            panic_with_error!(env, GeoAlertError::InvalidSeverity);
        }

        let active_sym = Symbol::new(&env, "active");

        let alert = GeoAlert {
            creator: creator.clone(),
            title,
            description,
            alert_type,
            latitude,
            longitude,
            radius,
            severity,
            acknowledged_by: creator,
            status: active_sym,
            created_at: env.ledger().timestamp(),
            expires_at,
        };

        let key = Self::item_key(&id);
        env.storage().instance().set(&key, &alert);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }

        let count = Self::get_active_count_val(&env);
        Self::set_active_count(&env, count + 1);
    }

    pub fn acknowledge_alert(env: Env, id: Symbol, responder: Address) {
        responder.require_auth();

        let key = Self::item_key(&id);
        let maybe_alert: Option<GeoAlert> = env.storage().instance().get(&key);

        if let Some(mut alert) = maybe_alert {
            let resolved_sym = Symbol::new(&env, "resolved");
            if alert.status == resolved_sym {
                panic_with_error!(env, GeoAlertError::AlreadyResolved);
            }

            let ack_sym = Symbol::new(&env, "ack");
            alert.status = ack_sym;
            alert.acknowledged_by = responder;
            env.storage().instance().set(&key, &alert);
        } else {
            panic_with_error!(env, GeoAlertError::NotFound);
        }
    }

    pub fn resolve_alert(env: Env, id: Symbol, creator: Address) {
        creator.require_auth();

        let key = Self::item_key(&id);
        let maybe_alert: Option<GeoAlert> = env.storage().instance().get(&key);

        if let Some(mut alert) = maybe_alert {
            if alert.creator != creator {
                panic_with_error!(env, GeoAlertError::NotCreator);
            }

            let resolved_sym = Symbol::new(&env, "resolved");
            if alert.status == resolved_sym {
                panic_with_error!(env, GeoAlertError::AlreadyResolved);
            }

            alert.status = resolved_sym;
            env.storage().instance().set(&key, &alert);

            let count = Self::get_active_count_val(&env);
            if count > 0 {
                Self::set_active_count(&env, count - 1);
            }
        } else {
            panic_with_error!(env, GeoAlertError::NotFound);
        }
    }

    pub fn escalate_alert(env: Env, id: Symbol, creator: Address) {
        creator.require_auth();

        let key = Self::item_key(&id);
        let maybe_alert: Option<GeoAlert> = env.storage().instance().get(&key);

        if let Some(mut alert) = maybe_alert {
            if alert.creator != creator {
                panic_with_error!(env, GeoAlertError::NotCreator);
            }
            if alert.severity >= 5 {
                panic_with_error!(env, GeoAlertError::MaxSeverity);
            }

            let resolved_sym = Symbol::new(&env, "resolved");
            if alert.status == resolved_sym {
                panic_with_error!(env, GeoAlertError::AlreadyResolved);
            }

            alert.severity += 1;
            env.storage().instance().set(&key, &alert);
        } else {
            panic_with_error!(env, GeoAlertError::NotFound);
        }
    }

    pub fn get_alert(env: Env, id: Symbol) -> Option<GeoAlert> {
        env.storage().instance().get(&Self::item_key(&id))
    }

    pub fn list_alerts(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_active_count(env: Env) -> u32 {
        Self::get_active_count_val(&env)
    }
}
