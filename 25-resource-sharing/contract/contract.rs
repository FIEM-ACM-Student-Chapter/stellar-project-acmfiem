#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct SharedResource {
    pub owner: Address,
    pub name: String,
    pub description: String,
    pub category: Symbol,
    pub daily_rate: i128,
    pub deposit_required: i128,
    pub borrower: Address,
    pub status: Symbol,
    pub total_rating: u32,
    pub rating_count: u32,
    pub borrow_count: u32,
    pub listed_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum ResourceDataKey {
    IdList,
    Item(Symbol),
    AvailableCount,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ResourceError {
    InvalidName = 1,
    InvalidTimestamp = 2,
    NotFound = 3,
    NotOwner = 4,
    NotBorrower = 5,
    NotAvailable = 6,
    AlreadyAvailable = 7,
    InvalidRating = 8,
    InvalidDates = 9,
}

#[contract]
pub struct ResourceSharingContract;

#[contractimpl]
impl ResourceSharingContract {
    fn ids_key() -> ResourceDataKey {
        ResourceDataKey::IdList
    }

    fn item_key(id: &Symbol) -> ResourceDataKey {
        ResourceDataKey::Item(id.clone())
    }

    fn available_count_key() -> ResourceDataKey {
        ResourceDataKey::AvailableCount
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

    fn get_available(env: &Env) -> u32 {
        env.storage().instance().get(&Self::available_count_key()).unwrap_or(0)
    }

    fn set_available(env: &Env, count: u32) {
        env.storage().instance().set(&Self::available_count_key(), &count);
    }

    pub fn list_resource(
        env: Env,
        id: Symbol,
        owner: Address,
        name: String,
        description: String,
        category: Symbol,
        daily_rate: i128,
        deposit_required: i128,
    ) {
        owner.require_auth();

        if name.len() == 0 {
            panic_with_error!(env, ResourceError::InvalidName);
        }

        let available_sym = Symbol::new(&env, "available");

        let resource = SharedResource {
            owner: owner.clone(),
            name,
            description,
            category,
            daily_rate,
            deposit_required,
            borrower: owner,
            status: available_sym,
            total_rating: 0,
            rating_count: 0,
            borrow_count: 0,
            listed_at: env.ledger().timestamp(),
        };

        let key = Self::item_key(&id);
        env.storage().instance().set(&key, &resource);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }

        let count = Self::get_available(&env);
        Self::set_available(&env, count + 1);
    }

    pub fn borrow_resource(
        env: Env,
        id: Symbol,
        borrower: Address,
        start_date: u64,
        end_date: u64,
    ) {
        borrower.require_auth();

        if end_date <= start_date {
            panic_with_error!(env, ResourceError::InvalidDates);
        }

        let key = Self::item_key(&id);
        let maybe_resource: Option<SharedResource> = env.storage().instance().get(&key);

        if let Some(mut resource) = maybe_resource {
            let available_sym = Symbol::new(&env, "available");
            if resource.status != available_sym {
                panic_with_error!(env, ResourceError::NotAvailable);
            }

            let borrowed_sym = Symbol::new(&env, "borrowed");
            resource.status = borrowed_sym;
            resource.borrower = borrower;
            resource.borrow_count += 1;
            env.storage().instance().set(&key, &resource);

            let count = Self::get_available(&env);
            if count > 0 {
                Self::set_available(&env, count - 1);
            }
        } else {
            panic_with_error!(env, ResourceError::NotFound);
        }
    }

    pub fn return_resource(env: Env, id: Symbol, borrower: Address, condition_notes: String) {
        borrower.require_auth();

        let key = Self::item_key(&id);
        let maybe_resource: Option<SharedResource> = env.storage().instance().get(&key);

        if let Some(mut resource) = maybe_resource {
            if resource.borrower != borrower {
                panic_with_error!(env, ResourceError::NotBorrower);
            }

            let borrowed_sym = Symbol::new(&env, "borrowed");
            if resource.status != borrowed_sym {
                panic_with_error!(env, ResourceError::AlreadyAvailable);
            }

            let returned_sym = Symbol::new(&env, "returned");
            resource.status = returned_sym;
            resource.description = condition_notes;
            env.storage().instance().set(&key, &resource);

            let count = Self::get_available(&env);
            Self::set_available(&env, count + 1);
        } else {
            panic_with_error!(env, ResourceError::NotFound);
        }
    }

    pub fn rate_transaction(env: Env, id: Symbol, rater: Address, rating: u32) {
        rater.require_auth();

        if rating == 0 || rating > 5 {
            panic_with_error!(env, ResourceError::InvalidRating);
        }

        let key = Self::item_key(&id);
        let maybe_resource: Option<SharedResource> = env.storage().instance().get(&key);

        if let Some(mut resource) = maybe_resource {
            resource.total_rating += rating;
            resource.rating_count += 1;
            env.storage().instance().set(&key, &resource);
        } else {
            panic_with_error!(env, ResourceError::NotFound);
        }
    }

    pub fn get_resource(env: Env, id: Symbol) -> Option<SharedResource> {
        env.storage().instance().get(&Self::item_key(&id))
    }

    pub fn list_resources(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_available_count(env: Env) -> u32 {
        Self::get_available(&env)
    }
}
