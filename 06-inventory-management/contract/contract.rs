#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Product {
    pub owner: Address,
    pub name: String,
    pub sku: String,
    pub quantity: u32,
    pub unit_price: i128,
    pub category: Symbol,
    pub discontinued: bool,
    pub added_at: u64,
    pub last_updated: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IdList,
    Product(Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    InvalidName = 1,
    InvalidTimestamp = 2,
    ProductNotFound = 3,
    NotOwner = 4,
    InsufficientStock = 5,
    AlreadyDiscontinued = 6,
}

#[contract]
pub struct InventoryManagementContract;

#[contractimpl]
impl InventoryManagementContract {
    fn ids_key() -> DataKey {
        DataKey::IdList
    }

    fn product_key(id: &Symbol) -> DataKey {
        DataKey::Product(id.clone())
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

    pub fn add_product(
        env: Env,
        id: Symbol,
        owner: Address,
        name: String,
        sku: String,
        quantity: u32,
        unit_price: i128,
        category: Symbol,
    ) {
        owner.require_auth();

        if name.len() == 0 {
            panic_with_error!(&env, ContractError::InvalidName);
        }

        let now = env.ledger().timestamp();

        let product = Product {
            owner,
            name,
            sku,
            quantity,
            unit_price,
            category,
            discontinued: false,
            added_at: now,
            last_updated: now,
        };

        let key = Self::product_key(&id);
        env.storage().instance().set(&key, &product);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn update_stock(
        env: Env,
        id: Symbol,
        owner: Address,
        quantity_change: u32,
        is_addition: bool,
    ) {
        owner.require_auth();

        let key = Self::product_key(&id);
        let mut product: Product = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::ProductNotFound));

        if product.owner != owner {
            panic_with_error!(&env, ContractError::NotOwner);
        }

        if product.discontinued {
            panic_with_error!(&env, ContractError::AlreadyDiscontinued);
        }

        if is_addition {
            product.quantity = product.quantity + quantity_change;
        } else {
            if product.quantity < quantity_change {
                panic_with_error!(&env, ContractError::InsufficientStock);
            }
            product.quantity = product.quantity - quantity_change;
        }

        product.last_updated = env.ledger().timestamp();
        env.storage().instance().set(&key, &product);
    }

    pub fn update_price(env: Env, id: Symbol, owner: Address, new_price: i128) {
        owner.require_auth();

        let key = Self::product_key(&id);
        let mut product: Product = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::ProductNotFound));

        if product.owner != owner {
            panic_with_error!(&env, ContractError::NotOwner);
        }

        product.unit_price = new_price;
        product.last_updated = env.ledger().timestamp();
        env.storage().instance().set(&key, &product);
    }

    pub fn discontinue_product(env: Env, id: Symbol, owner: Address) {
        owner.require_auth();

        let key = Self::product_key(&id);
        let mut product: Product = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::ProductNotFound));

        if product.owner != owner {
            panic_with_error!(&env, ContractError::NotOwner);
        }

        product.discontinued = true;
        product.last_updated = env.ledger().timestamp();
        env.storage().instance().set(&key, &product);
    }

    pub fn get_product(env: Env, id: Symbol) -> Option<Product> {
        env.storage().instance().get(&Self::product_key(&id))
    }

    pub fn list_products(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_low_stock(env: Env, threshold: u32) -> Vec<Symbol> {
        let ids = Self::load_ids(&env);
        let mut low: Vec<Symbol> = Vec::new(&env);
        for id in ids.iter() {
            let key = Self::product_key(&id);
            if let Some(product) = env.storage().instance().get::<DataKey, Product>(&key) {
                if !product.discontinued && product.quantity < threshold {
                    low.push_back(id);
                }
            }
        }
        low
    }

    pub fn get_total_value(env: Env) -> i128 {
        let ids = Self::load_ids(&env);
        let mut total: i128 = 0;
        for id in ids.iter() {
            let key = Self::product_key(&id);
            if let Some(product) = env.storage().instance().get::<DataKey, Product>(&key) {
                if !product.discontinued {
                    total = total + (product.quantity as i128) * product.unit_price;
                }
            }
        }
        total
    }
}
