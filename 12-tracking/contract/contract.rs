#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Shipment {
    pub sender: Address,
    pub receiver_name: String,
    pub origin: String,
    pub destination: String,
    pub weight: u32,
    pub status: Symbol,
    pub current_location: String,
    pub checkpoint_count: u32,
    pub created_at: u64,
    pub delivered_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct Checkpoint {
    pub location: String,
    pub notes: String,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    ShipmentList,
    Shipment(Symbol),
    ShipmentCount,
    Checkpoint(Symbol, u32),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TrackingError {
    ShipmentNotFound = 1,
    ShipmentAlreadyExists = 2,
    NotSender = 3,
    AlreadyDelivered = 4,
    InvalidOrigin = 5,
    InvalidDestination = 6,
    InvalidTimestamp = 7,
}

#[contract]
pub struct TrackingContract;

#[contractimpl]
impl TrackingContract {
    fn load_ids(env: &Env) -> Vec<Symbol> {
        env.storage()
            .instance()
            .get(&DataKey::ShipmentList)
            .unwrap_or(Vec::new(env))
    }

    fn save_ids(env: &Env, ids: &Vec<Symbol>) {
        env.storage().instance().set(&DataKey::ShipmentList, ids);
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
            .get(&DataKey::ShipmentCount)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::ShipmentCount, &(count + 1));
    }

    pub fn create_shipment(
        env: Env,
        id: Symbol,
        sender: Address,
        receiver_name: String,
        origin: String,
        destination: String,
        weight: u32,
    ) {
        sender.require_auth();

        if origin.len() == 0 {
            panic_with_error!(env, TrackingError::InvalidOrigin);
        }
        if destination.len() == 0 {
            panic_with_error!(env, TrackingError::InvalidDestination);
        }

        let key = DataKey::Shipment(id.clone());
        if env.storage().instance().has(&key) {
            panic_with_error!(env, TrackingError::ShipmentAlreadyExists);
        }

        let shipment = Shipment {
            sender,
            receiver_name,
            origin: origin.clone(),
            destination,
            weight,
            status: Symbol::new(&env, "created"),
            current_location: origin,
            checkpoint_count: 0,
            created_at: env.ledger().timestamp(),
            delivered_at: 0,
        };

        env.storage().instance().set(&key, &shipment);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
            Self::increment_count(&env);
        }
    }

    pub fn update_status(
        env: Env,
        id: Symbol,
        sender: Address,
        new_status: Symbol,
        location: String,
        timestamp: u64,
    ) {
        sender.require_auth();

        if timestamp == 0 {
            panic_with_error!(env, TrackingError::InvalidTimestamp);
        }

        let key = DataKey::Shipment(id.clone());
        let mut shipment: Shipment = env
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, TrackingError::ShipmentNotFound));

        if shipment.sender != sender {
            panic_with_error!(env, TrackingError::NotSender);
        }
        if shipment.delivered_at > 0 {
            panic_with_error!(env, TrackingError::AlreadyDelivered);
        }

        shipment.status = new_status;
        shipment.current_location = location;
        env.storage().instance().set(&key, &shipment);
    }

    pub fn add_checkpoint(
        env: Env,
        id: Symbol,
        sender: Address,
        location: String,
        notes: String,
        timestamp: u64,
    ) {
        sender.require_auth();

        if timestamp == 0 {
            panic_with_error!(env, TrackingError::InvalidTimestamp);
        }

        let key = DataKey::Shipment(id.clone());
        let mut shipment: Shipment = env
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, TrackingError::ShipmentNotFound));

        if shipment.sender != sender {
            panic_with_error!(env, TrackingError::NotSender);
        }

        let cp_index = shipment.checkpoint_count;
        let checkpoint = Checkpoint {
            location: location.clone(),
            notes,
            timestamp,
        };

        env.storage()
            .instance()
            .set(&DataKey::Checkpoint(id.clone(), cp_index), &checkpoint);

        shipment.checkpoint_count += 1;
        shipment.current_location = location;
        env.storage().instance().set(&key, &shipment);
    }

    pub fn mark_delivered(env: Env, id: Symbol, sender: Address, timestamp: u64) {
        sender.require_auth();

        if timestamp == 0 {
            panic_with_error!(env, TrackingError::InvalidTimestamp);
        }

        let key = DataKey::Shipment(id.clone());
        let mut shipment: Shipment = env
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, TrackingError::ShipmentNotFound));

        if shipment.sender != sender {
            panic_with_error!(env, TrackingError::NotSender);
        }
        if shipment.delivered_at > 0 {
            panic_with_error!(env, TrackingError::AlreadyDelivered);
        }

        shipment.status = Symbol::new(&env, "delivered");
        shipment.current_location = shipment.destination.clone();
        shipment.delivered_at = timestamp;
        env.storage().instance().set(&key, &shipment);
    }

    pub fn get_shipment(env: Env, id: Symbol) -> Option<Shipment> {
        env.storage().instance().get(&DataKey::Shipment(id))
    }

    pub fn list_shipments(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_shipment_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::ShipmentCount)
            .unwrap_or(0)
    }
}
