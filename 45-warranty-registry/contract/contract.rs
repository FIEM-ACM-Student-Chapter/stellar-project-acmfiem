#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Warranty {
    pub owner: Address,
    pub provider: Address,
    pub product_name: String,
    pub serial_number: String,
    pub status: Symbol,
    pub claim_note: String,
    pub claim_count: u32,
    pub purchased_at: u64,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum WarrantyDataKey {
    IdList,
    Warranty(Symbol),
    WarrantyCount,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum WarrantyError {
    InvalidName = 1,
    InvalidClaim = 2,
    InvalidTimestamp = 3,
    NotFound = 4,
    Unauthorized = 5,
    AlreadyExists = 6,
    ClaimNotOpen = 7,
    ClaimAlreadyOpen = 8,
}

#[contract]
pub struct WarrantyRegistryContract;

#[contractimpl]
impl WarrantyRegistryContract {
    fn ids_key() -> WarrantyDataKey {
        WarrantyDataKey::IdList
    }

    fn warranty_key(id: &Symbol) -> WarrantyDataKey {
        WarrantyDataKey::Warranty(id.clone())
    }

    fn count_key() -> WarrantyDataKey {
        WarrantyDataKey::WarrantyCount
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

    pub fn register_warranty(
        env: Env,
        id: Symbol,
        owner: Address,
        provider: Address,
        product_name: String,
        serial_number: String,
        purchased_at: u64,
        expires_at: u64,
    ) {
        owner.require_auth();

        if product_name.len() == 0 {
            panic_with_error!(&env, WarrantyError::InvalidName);
        }
        if purchased_at == 0 || expires_at == 0 {
            panic_with_error!(&env, WarrantyError::InvalidTimestamp);
        }

        let key = Self::warranty_key(&id);
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, WarrantyError::AlreadyExists);
        }

        let warranty = Warranty {
            owner,
            provider,
            product_name,
            serial_number,
            status: Symbol::new(&env, "active"),
            claim_note: String::from_str(&env, ""),
            claim_count: 0,
            purchased_at,
            expires_at,
        };

        env.storage().instance().set(&key, &warranty);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }

        let count: u32 = env.storage().instance().get(&Self::count_key()).unwrap_or(0);
        env.storage().instance().set(&Self::count_key(), &(count + 1));
    }

    pub fn transfer_warranty(env: Env, id: Symbol, owner: Address, new_owner: Address) {
        owner.require_auth();

        let key = Self::warranty_key(&id);
        let maybe_warranty: Option<Warranty> = env.storage().instance().get(&key);

        if let Some(mut warranty) = maybe_warranty {
            if warranty.owner != owner {
                panic_with_error!(&env, WarrantyError::Unauthorized);
            }

            warranty.owner = new_owner;
            env.storage().instance().set(&key, &warranty);
        } else {
            panic_with_error!(&env, WarrantyError::NotFound);
        }
    }

    pub fn file_claim(env: Env, id: Symbol, owner: Address, claim_note: String) {
        owner.require_auth();

        if claim_note.len() == 0 {
            panic_with_error!(&env, WarrantyError::InvalidClaim);
        }

        let key = Self::warranty_key(&id);
        let maybe_warranty: Option<Warranty> = env.storage().instance().get(&key);

        if let Some(mut warranty) = maybe_warranty {
            if warranty.owner != owner {
                panic_with_error!(&env, WarrantyError::Unauthorized);
            }

            let claim_open = Symbol::new(&env, "claim_open");
            if warranty.status == claim_open {
                panic_with_error!(&env, WarrantyError::ClaimAlreadyOpen);
            }

            warranty.status = claim_open;
            warranty.claim_note = claim_note;
            warranty.claim_count += 1;
            env.storage().instance().set(&key, &warranty);
        } else {
            panic_with_error!(&env, WarrantyError::NotFound);
        }
    }

    pub fn close_claim(env: Env, id: Symbol, provider: Address) {
        provider.require_auth();

        let key = Self::warranty_key(&id);
        let maybe_warranty: Option<Warranty> = env.storage().instance().get(&key);

        if let Some(mut warranty) = maybe_warranty {
            if warranty.provider != provider {
                panic_with_error!(&env, WarrantyError::Unauthorized);
            }

            let claim_open = Symbol::new(&env, "claim_open");
            if warranty.status != claim_open {
                panic_with_error!(&env, WarrantyError::ClaimNotOpen);
            }

            warranty.status = Symbol::new(&env, "active");
            env.storage().instance().set(&key, &warranty);
        } else {
            panic_with_error!(&env, WarrantyError::NotFound);
        }
    }

    pub fn get_warranty(env: Env, id: Symbol) -> Option<Warranty> {
        env.storage().instance().get(&Self::warranty_key(&id))
    }

    pub fn list_warranties(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_warranty_count(env: Env) -> u32 {
        env.storage().instance().get(&Self::count_key()).unwrap_or(0)
    }
}

