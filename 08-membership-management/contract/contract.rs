#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Member {
    pub member: Address,
    pub name: String,
    pub email: String,
    pub tier: Symbol,
    pub status: Symbol,
    pub joined_at: u64,
    pub expires_at: u64,
    pub renewed_count: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IdList,
    Member(Symbol),
    Count,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    InvalidName = 1,
    InvalidTimestamp = 2,
    MemberNotFound = 3,
    NotMember = 4,
    InvalidTier = 5,
    AlreadySuspended = 6,
    AlreadyActive = 7,
}

#[contract]
pub struct MembershipManagementContract;

#[contractimpl]
impl MembershipManagementContract {
    fn ids_key() -> DataKey {
        DataKey::IdList
    }

    fn member_key(id: &Symbol) -> DataKey {
        DataKey::Member(id.clone())
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

    pub fn register_member(
        env: Env,
        id: Symbol,
        member: Address,
        name: String,
        email: String,
        tier: Symbol,
        joined_at: u64,
    ) {
        member.require_auth();

        if name.len() == 0 {
            panic_with_error!(&env, ContractError::InvalidName);
        }

        if joined_at == 0 {
            panic_with_error!(&env, ContractError::InvalidTimestamp);
        }

        let active = Symbol::new(&env, "active");

        let record = Member {
            member,
            name,
            email,
            tier,
            status: active,
            joined_at,
            expires_at: 0,
            renewed_count: 0,
        };

        let key = Self::member_key(&id);
        let exists = env.storage().instance().has(&key);
        env.storage().instance().set(&key, &record);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
            if !exists {
                Self::increment_count(&env);
            }
        }
    }

    pub fn upgrade_tier(env: Env, id: Symbol, member: Address, new_tier: Symbol) {
        member.require_auth();

        let key = Self::member_key(&id);
        let mut record: Member = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::MemberNotFound));

        if record.member != member {
            panic_with_error!(&env, ContractError::NotMember);
        }

        record.tier = new_tier;
        env.storage().instance().set(&key, &record);
    }

    pub fn renew_membership(env: Env, id: Symbol, member: Address, new_expiry: u64) {
        member.require_auth();

        let key = Self::member_key(&id);
        let mut record: Member = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::MemberNotFound));

        if record.member != member {
            panic_with_error!(&env, ContractError::NotMember);
        }

        let active = Symbol::new(&env, "active");
        record.expires_at = new_expiry;
        record.status = active;
        record.renewed_count = record.renewed_count + 1;
        env.storage().instance().set(&key, &record);
    }

    pub fn suspend_member(env: Env, id: Symbol, admin: Address) {
        admin.require_auth();

        let key = Self::member_key(&id);
        let mut record: Member = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::MemberNotFound));

        let suspended = Symbol::new(&env, "suspended");
        if record.status == suspended {
            panic_with_error!(&env, ContractError::AlreadySuspended);
        }

        record.status = suspended;
        env.storage().instance().set(&key, &record);
    }

    pub fn activate_member(env: Env, id: Symbol, admin: Address) {
        admin.require_auth();

        let key = Self::member_key(&id);
        let mut record: Member = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::MemberNotFound));

        let active = Symbol::new(&env, "active");
        if record.status == active {
            panic_with_error!(&env, ContractError::AlreadyActive);
        }

        record.status = active;
        env.storage().instance().set(&key, &record);
    }

    pub fn get_member(env: Env, id: Symbol) -> Option<Member> {
        env.storage().instance().get(&Self::member_key(&id))
    }

    pub fn list_members(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_member_count(env: Env) -> u32 {
        env.storage().instance().get(&Self::count_key()).unwrap_or(0)
    }
}
