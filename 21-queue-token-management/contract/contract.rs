#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Queue {
    pub admin: Address,
    pub queue_name: String,
    pub max_capacity: u32,
    pub next_token: u32,
    pub current_serving: u32,
    pub total_served: u32,
    pub skipped_count: u32,
    pub is_active: bool,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum QueueDataKey {
    IdList,
    Item(Symbol),
    Skipped(Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum QueueError {
    InvalidName = 1,
    InvalidTimestamp = 2,
    NotFound = 3,
    NotAdmin = 4,
    QueueFull = 5,
    QueueEmpty = 6,
    AlreadyExists = 7,
    QueueInactive = 8,
}

#[contract]
pub struct QueueTokenManagementContract;

#[contractimpl]
impl QueueTokenManagementContract {
    fn ids_key() -> QueueDataKey {
        QueueDataKey::IdList
    }

    fn item_key(id: &Symbol) -> QueueDataKey {
        QueueDataKey::Item(id.clone())
    }

    fn skipped_key(id: &Symbol) -> QueueDataKey {
        QueueDataKey::Skipped(id.clone())
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

    fn load_skipped(env: &Env, queue_id: &Symbol) -> Vec<u32> {
        env.storage().instance().get(&Self::skipped_key(queue_id)).unwrap_or(Vec::new(env))
    }

    fn save_skipped(env: &Env, queue_id: &Symbol, skipped: &Vec<u32>) {
        env.storage().instance().set(&Self::skipped_key(queue_id), skipped);
    }

    fn is_skipped(skipped: &Vec<u32>, token: u32) -> bool {
        for s in skipped.iter() {
            if s == token {
                return true;
            }
        }
        false
    }

    pub fn create_queue(env: Env, id: Symbol, admin: Address, queue_name: String, max_capacity: u32) {
        admin.require_auth();

        if queue_name.len() == 0 {
            panic_with_error!(env, QueueError::InvalidName);
        }

        let key = Self::item_key(&id);
        if env.storage().instance().has(&key) {
            panic_with_error!(env, QueueError::AlreadyExists);
        }

        let queue = Queue {
            admin,
            queue_name,
            max_capacity,
            next_token: 1,
            current_serving: 0,
            total_served: 0,
            skipped_count: 0,
            is_active: true,
            created_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&key, &queue);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn take_token(env: Env, queue_id: Symbol, customer: Address) -> u32 {
        customer.require_auth();

        let key = Self::item_key(&queue_id);
        let maybe_queue: Option<Queue> = env.storage().instance().get(&key);

        if let Some(mut queue) = maybe_queue {
            if !queue.is_active {
                panic_with_error!(env, QueueError::QueueInactive);
            }

            let waiting = queue.next_token - queue.current_serving - 1;
            if waiting >= queue.max_capacity {
                panic_with_error!(env, QueueError::QueueFull);
            }

            let token = queue.next_token;
            queue.next_token += 1;
            env.storage().instance().set(&key, &queue);
            token
        } else {
            panic_with_error!(env, QueueError::NotFound);
        }
    }

    pub fn call_next(env: Env, queue_id: Symbol, admin: Address) -> u32 {
        admin.require_auth();

        let key = Self::item_key(&queue_id);
        let maybe_queue: Option<Queue> = env.storage().instance().get(&key);

        if let Some(mut queue) = maybe_queue {
            if queue.admin != admin {
                panic_with_error!(env, QueueError::NotAdmin);
            }

            let skipped = Self::load_skipped(&env, &queue_id);
            let mut next = queue.current_serving + 1;

            while next < queue.next_token && Self::is_skipped(&skipped, next) {
                next += 1;
            }

            if next >= queue.next_token {
                panic_with_error!(env, QueueError::QueueEmpty);
            }

            queue.current_serving = next;
            queue.total_served += 1;
            env.storage().instance().set(&key, &queue);
            next
        } else {
            panic_with_error!(env, QueueError::NotFound);
        }
    }

    pub fn skip_token(env: Env, queue_id: Symbol, admin: Address, token_number: u32) {
        admin.require_auth();

        let key = Self::item_key(&queue_id);
        let maybe_queue: Option<Queue> = env.storage().instance().get(&key);

        if let Some(mut queue) = maybe_queue {
            if queue.admin != admin {
                panic_with_error!(env, QueueError::NotAdmin);
            }

            let mut skipped = Self::load_skipped(&env, &queue_id);
            if !Self::is_skipped(&skipped, token_number) {
                skipped.push_back(token_number);
                Self::save_skipped(&env, &queue_id, &skipped);
                queue.skipped_count += 1;
                env.storage().instance().set(&key, &queue);
            }
        } else {
            panic_with_error!(env, QueueError::NotFound);
        }
    }

    pub fn get_queue(env: Env, id: Symbol) -> Option<Queue> {
        env.storage().instance().get(&Self::item_key(&id))
    }

    pub fn list_queues(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_current_wait(env: Env, queue_id: Symbol) -> u32 {
        let key = Self::item_key(&queue_id);
        let maybe_queue: Option<Queue> = env.storage().instance().get(&key);

        if let Some(queue) = maybe_queue {
            if queue.next_token <= queue.current_serving + 1 {
                0
            } else {
                queue.next_token - queue.current_serving - 1
            }
        } else {
            0
        }
    }
}
