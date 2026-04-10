#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Member {
    pub owner: Address,
    pub name: String,
    pub tier: Symbol,
    pub points: i128,
    pub active: bool,
    pub joined_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum MemberDataKey {
    IdList,
    Member(Symbol),
    MemberCount,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum LoyaltyError {
    InvalidName = 1,
    InvalidPoints = 2,
    InvalidTimestamp = 3,
    NotFound = 4,
    Unauthorized = 5,
    AlreadyExists = 6,
    InsufficientPoints = 7,
    MemberInactive = 8,
}

#[contract]
pub struct LoyaltyRewardsContract;

#[contractimpl]
impl LoyaltyRewardsContract {
    fn ids_key() -> MemberDataKey {
        MemberDataKey::IdList
    }

    fn member_key(id: &Symbol) -> MemberDataKey {
        MemberDataKey::Member(id.clone())
    }

    fn count_key() -> MemberDataKey {
        MemberDataKey::MemberCount
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

    pub fn create_member(
        env: Env,
        id: Symbol,
        owner: Address,
        name: String,
        tier: Symbol,
        joined_at: u64,
    ) {
        owner.require_auth();

        if name.len() == 0 {
            panic_with_error!(&env, LoyaltyError::InvalidName);
        }
        if joined_at == 0 {
            panic_with_error!(&env, LoyaltyError::InvalidTimestamp);
        }

        let key = Self::member_key(&id);
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, LoyaltyError::AlreadyExists);
        }

        let member = Member {
            owner,
            name,
            tier,
            points: 0,
            active: true,
            joined_at,
            updated_at: joined_at,
        };

        env.storage().instance().set(&key, &member);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }

        let count: u32 = env.storage().instance().get(&Self::count_key()).unwrap_or(0);
        env.storage().instance().set(&Self::count_key(), &(count + 1));
    }

    pub fn add_points(env: Env, id: Symbol, owner: Address, amount: i128) {
        owner.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, LoyaltyError::InvalidPoints);
        }

        let key = Self::member_key(&id);
        let maybe_member: Option<Member> = env.storage().instance().get(&key);

        if let Some(mut member) = maybe_member {
            if member.owner != owner {
                panic_with_error!(&env, LoyaltyError::Unauthorized);
            }
            if !member.active {
                panic_with_error!(&env, LoyaltyError::MemberInactive);
            }

            member.points += amount;
            member.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &member);
        } else {
            panic_with_error!(&env, LoyaltyError::NotFound);
        }
    }

    pub fn redeem_points(env: Env, id: Symbol, owner: Address, amount: i128) {
        owner.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, LoyaltyError::InvalidPoints);
        }

        let key = Self::member_key(&id);
        let maybe_member: Option<Member> = env.storage().instance().get(&key);

        if let Some(mut member) = maybe_member {
            if member.owner != owner {
                panic_with_error!(&env, LoyaltyError::Unauthorized);
            }
            if !member.active {
                panic_with_error!(&env, LoyaltyError::MemberInactive);
            }
            if member.points < amount {
                panic_with_error!(&env, LoyaltyError::InsufficientPoints);
            }

            member.points -= amount;
            member.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &member);
        } else {
            panic_with_error!(&env, LoyaltyError::NotFound);
        }
    }

    pub fn update_tier(env: Env, id: Symbol, owner: Address, tier: Symbol) {
        owner.require_auth();

        let key = Self::member_key(&id);
        let maybe_member: Option<Member> = env.storage().instance().get(&key);

        if let Some(mut member) = maybe_member {
            if member.owner != owner {
                panic_with_error!(&env, LoyaltyError::Unauthorized);
            }
            if !member.active {
                panic_with_error!(&env, LoyaltyError::MemberInactive);
            }

            member.tier = tier;
            member.updated_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &member);
        } else {
            panic_with_error!(&env, LoyaltyError::NotFound);
        }
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
