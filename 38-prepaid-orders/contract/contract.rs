#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Order {
    pub seller: Address,
    pub buyer: Address,
    pub description: String,
    pub items_count: u32,
    pub total_amount: i128,
    pub paid_amount: i128,
    pub tracking_info: String,
    pub dispute_reason: String,
    pub status: Symbol,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum OrderDataKey {
    OrderList,
    Order(Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum OrderError {
    DescriptionEmpty = 1,
    InvalidAmount = 2,
    OrderNotFound = 3,
    InsufficientPayment = 4,
    InvalidStatus = 5,
    NotSeller = 6,
    NotBuyer = 7,
}

#[contract]
pub struct PrepaidOrdersContract;

#[contractimpl]
impl PrepaidOrdersContract {
    fn order_key(id: &Symbol) -> OrderDataKey {
        OrderDataKey::Order(id.clone())
    }

    fn list_key() -> OrderDataKey {
        OrderDataKey::OrderList
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

    pub fn create_order(
        env: Env,
        id: Symbol,
        seller: Address,
        buyer: Address,
        description: String,
        items_count: u32,
        total_amount: i128,
    ) {
        seller.require_auth();

        if description.len() == 0 {
            panic_with_error!(&env, OrderError::DescriptionEmpty);
        }
        if total_amount <= 0 {
            panic_with_error!(&env, OrderError::InvalidAmount);
        }

        let now = env.ledger().timestamp();
        let order = Order {
            seller,
            buyer,
            description,
            items_count,
            total_amount,
            paid_amount: 0,
            tracking_info: String::from_str(&env, ""),
            dispute_reason: String::from_str(&env, ""),
            status: Symbol::new(&env, "created"),
            created_at: now,
            updated_at: now,
        };

        env.storage().instance().set(&Self::order_key(&id), &order);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            env.storage().instance().set(&Self::list_key(), &ids);
        }
    }

    pub fn pay_order(env: Env, id: Symbol, buyer: Address, payment_amount: i128) {
        buyer.require_auth();

        let key = Self::order_key(&id);
        let maybe_order: Option<Order> = env.storage().instance().get(&key);
        if maybe_order.is_none() {
            panic_with_error!(&env, OrderError::OrderNotFound);
        }
        let mut order = maybe_order.unwrap();

        if payment_amount <= 0 {
            panic_with_error!(&env, OrderError::InvalidAmount);
        }

        order.paid_amount += payment_amount;
        order.status = Symbol::new(&env, "paid");
        order.updated_at = env.ledger().timestamp();
        env.storage().instance().set(&key, &order);
    }

    pub fn confirm_order(env: Env, id: Symbol, seller: Address) {
        seller.require_auth();

        let key = Self::order_key(&id);
        let maybe_order: Option<Order> = env.storage().instance().get(&key);
        if maybe_order.is_none() {
            panic_with_error!(&env, OrderError::OrderNotFound);
        }
        let mut order = maybe_order.unwrap();

        order.status = Symbol::new(&env, "confirmed");
        order.updated_at = env.ledger().timestamp();
        env.storage().instance().set(&key, &order);
    }

    pub fn ship_order(env: Env, id: Symbol, seller: Address, tracking_info: String) {
        seller.require_auth();

        let key = Self::order_key(&id);
        let maybe_order: Option<Order> = env.storage().instance().get(&key);
        if maybe_order.is_none() {
            panic_with_error!(&env, OrderError::OrderNotFound);
        }
        let mut order = maybe_order.unwrap();

        order.tracking_info = tracking_info;
        order.status = Symbol::new(&env, "shipped");
        order.updated_at = env.ledger().timestamp();
        env.storage().instance().set(&key, &order);
    }

    pub fn deliver_order(env: Env, id: Symbol, seller: Address) {
        seller.require_auth();

        let key = Self::order_key(&id);
        let maybe_order: Option<Order> = env.storage().instance().get(&key);
        if maybe_order.is_none() {
            panic_with_error!(&env, OrderError::OrderNotFound);
        }
        let mut order = maybe_order.unwrap();

        order.status = Symbol::new(&env, "delivered");
        order.updated_at = env.ledger().timestamp();
        env.storage().instance().set(&key, &order);
    }

    pub fn dispute_order(env: Env, id: Symbol, buyer: Address, reason: String) {
        buyer.require_auth();

        let key = Self::order_key(&id);
        let maybe_order: Option<Order> = env.storage().instance().get(&key);
        if maybe_order.is_none() {
            panic_with_error!(&env, OrderError::OrderNotFound);
        }
        let mut order = maybe_order.unwrap();

        order.dispute_reason = reason;
        order.status = Symbol::new(&env, "disputed");
        order.updated_at = env.ledger().timestamp();
        env.storage().instance().set(&key, &order);
    }

    pub fn get_order(env: Env, id: Symbol) -> Option<Order> {
        env.storage().instance().get(&Self::order_key(&id))
    }

    pub fn list_orders(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }
}
