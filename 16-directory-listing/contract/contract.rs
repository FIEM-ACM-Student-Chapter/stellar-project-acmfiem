#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Listing {
    pub owner: Address,
    pub name: String,
    pub category: Symbol,
    pub description: String,
    pub contact: String,
    pub website: String,
    pub location: String,
    pub is_verified: bool,
    pub is_active: bool,
    pub total_rating: u32,
    pub rating_count: u32,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IdList,
    Item(Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum DirectoryError {
    NotFound = 1,
    NotOwner = 2,
    AlreadyExists = 3,
    InvalidName = 4,
    InvalidRating = 5,
    ListingInactive = 6,
}

#[contract]
pub struct DirectoryListingContract;

#[contractimpl]
impl DirectoryListingContract {
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

    pub fn create_listing(
        env: Env,
        id: Symbol,
        owner: Address,
        name: String,
        category: Symbol,
        description: String,
        contact: String,
        website: String,
        location: String,
    ) {
        owner.require_auth();

        if name.len() == 0 {
            panic_with_error!(&env, DirectoryError::InvalidName);
        }

        let key = DataKey::Item(id.clone());
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, DirectoryError::AlreadyExists);
        }

        let listing = Listing {
            owner,
            name,
            category,
            description,
            contact,
            website,
            location,
            is_verified: false,
            is_active: true,
            total_rating: 0,
            rating_count: 0,
            created_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&key, &listing);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn update_listing(
        env: Env,
        id: Symbol,
        owner: Address,
        name: String,
        description: String,
        contact: String,
        website: String,
    ) {
        owner.require_auth();

        let key = DataKey::Item(id.clone());
        let maybe: Option<Listing> = env.storage().instance().get(&key);

        if let Some(mut listing) = maybe {
            if listing.owner != owner {
                panic_with_error!(&env, DirectoryError::NotOwner);
            }
            if name.len() == 0 {
                panic_with_error!(&env, DirectoryError::InvalidName);
            }
            listing.name = name;
            listing.description = description;
            listing.contact = contact;
            listing.website = website;
            env.storage().instance().set(&key, &listing);
        } else {
            panic_with_error!(&env, DirectoryError::NotFound);
        }
    }

    pub fn verify_listing(env: Env, id: Symbol, verifier: Address) {
        verifier.require_auth();

        let key = DataKey::Item(id.clone());
        let maybe: Option<Listing> = env.storage().instance().get(&key);

        if let Some(mut listing) = maybe {
            listing.is_verified = true;
            env.storage().instance().set(&key, &listing);
        } else {
            panic_with_error!(&env, DirectoryError::NotFound);
        }
    }

    pub fn deactivate_listing(env: Env, id: Symbol, owner: Address) {
        owner.require_auth();

        let key = DataKey::Item(id.clone());
        let maybe: Option<Listing> = env.storage().instance().get(&key);

        if let Some(mut listing) = maybe {
            if listing.owner != owner {
                panic_with_error!(&env, DirectoryError::NotOwner);
            }
            listing.is_active = false;
            env.storage().instance().set(&key, &listing);
        } else {
            panic_with_error!(&env, DirectoryError::NotFound);
        }
    }

    pub fn rate_listing(env: Env, id: Symbol, rater: Address, rating: u32) {
        rater.require_auth();

        if rating < 1 || rating > 5 {
            panic_with_error!(&env, DirectoryError::InvalidRating);
        }

        let key = DataKey::Item(id.clone());
        let maybe: Option<Listing> = env.storage().instance().get(&key);

        if let Some(mut listing) = maybe {
            if !listing.is_active {
                panic_with_error!(&env, DirectoryError::ListingInactive);
            }
            listing.total_rating += rating;
            listing.rating_count += 1;
            env.storage().instance().set(&key, &listing);
        } else {
            panic_with_error!(&env, DirectoryError::NotFound);
        }
    }

    pub fn get_listing(env: Env, id: Symbol) -> Option<Listing> {
        env.storage().instance().get(&DataKey::Item(id))
    }

    pub fn list_all(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }
}
