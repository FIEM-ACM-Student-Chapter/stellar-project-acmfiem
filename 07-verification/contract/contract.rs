#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Credential {
    pub holder: Address,
    pub credential_type: Symbol,
    pub issuer_name: String,
    pub data_hash: String,
    pub verified_by: Address,
    pub is_verified: bool,
    pub is_revoked: bool,
    pub issued_at: u64,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IdList,
    Credential(Symbol),
    Count,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    InvalidDataHash = 1,
    InvalidTimestamp = 2,
    CredentialNotFound = 3,
    NotHolder = 4,
    AlreadyVerified = 5,
    AlreadyRevoked = 6,
}

#[contract]
pub struct VerificationContract;

#[contractimpl]
impl VerificationContract {
    fn ids_key() -> DataKey {
        DataKey::IdList
    }

    fn credential_key(id: &Symbol) -> DataKey {
        DataKey::Credential(id.clone())
    }

    fn count_key() -> DataKey {
        DataKey::Count
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

    fn increment_count(env: &Env) {
        let count: u32 = env.storage().instance().get(&Self::count_key()).unwrap_or(0);
        env.storage().instance().set(&Self::count_key(), &(count + 1));
    }

    pub fn submit_credential(
        env: Env,
        id: Symbol,
        holder: Address,
        credential_type: Symbol,
        issuer_name: String,
        data_hash: String,
        issued_at: u64,
        expires_at: u64,
    ) {
        holder.require_auth();

        if data_hash.len() == 0 {
            panic_with_error!(&env, ContractError::InvalidDataHash);
        }

        if issued_at == 0 || expires_at == 0 {
            panic_with_error!(&env, ContractError::InvalidTimestamp);
        }

        let credential = Credential {
            holder: holder.clone(),
            credential_type,
            issuer_name,
            data_hash,
            verified_by: holder,
            is_verified: false,
            is_revoked: false,
            issued_at,
            expires_at,
        };

        let key = Self::credential_key(&id);
        let exists = env.storage().instance().has(&key);
        env.storage().instance().set(&key, &credential);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
            if !exists {
                Self::increment_count(&env);
            }
        }
    }

    pub fn verify_credential(env: Env, id: Symbol, verifier: Address) {
        verifier.require_auth();

        let key = Self::credential_key(&id);
        let mut credential: Credential = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::CredentialNotFound));

        if credential.is_revoked {
            panic_with_error!(&env, ContractError::AlreadyRevoked);
        }

        credential.is_verified = true;
        credential.verified_by = verifier;
        env.storage().instance().set(&key, &credential);
    }

    pub fn revoke_credential(env: Env, id: Symbol, holder: Address) {
        holder.require_auth();

        let key = Self::credential_key(&id);
        let mut credential: Credential = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::CredentialNotFound));

        if credential.holder != holder {
            panic_with_error!(&env, ContractError::NotHolder);
        }

        credential.is_revoked = true;
        env.storage().instance().set(&key, &credential);
    }

    pub fn check_validity(env: Env, id: Symbol) -> bool {
        let key = Self::credential_key(&id);
        if let Some(credential) = env.storage().instance().get::<DataKey, Credential>(&key) {
            let now = env.ledger().timestamp();
            credential.is_verified && !credential.is_revoked && now < credential.expires_at
        } else {
            false
        }
    }

    pub fn get_credential(env: Env, id: Symbol) -> Option<Credential> {
        env.storage().instance().get(&Self::credential_key(&id))
    }

    pub fn list_credentials(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_credential_count(env: Env) -> u32 {
        env.storage().instance().get(&Self::count_key()).unwrap_or(0)
    }
}
