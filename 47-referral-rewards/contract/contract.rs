#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Campaign {
    pub promoter: Address,
    pub title: String,
    pub reward_amount: i128,
    pub status: Symbol,
    pub referral_count: u32,
    pub approved_count: u32,
    pub reward_count: u32,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum ReferralDataKey {
    IdList,
    Campaign(Symbol),
    RewardCount,
    Registered(Symbol, Address),
    Approved(Symbol, Address),
    Rewarded(Symbol, Address),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ReferralError {
    InvalidTitle = 1,
    InvalidReward = 2,
    NotFound = 3,
    Unauthorized = 4,
    AlreadyExists = 5,
    AlreadyRegistered = 6,
    NotRegistered = 7,
    AlreadyApproved = 8,
    NotApproved = 9,
    AlreadyRewarded = 10,
    InvalidTimestamp = 11,
}

#[contract]
pub struct ReferralRewardsContract;

#[contractimpl]
impl ReferralRewardsContract {
    fn ids_key() -> ReferralDataKey {
        ReferralDataKey::IdList
    }

    fn campaign_key(id: &Symbol) -> ReferralDataKey {
        ReferralDataKey::Campaign(id.clone())
    }

    fn reward_count_key() -> ReferralDataKey {
        ReferralDataKey::RewardCount
    }

    fn registered_key(id: &Symbol, friend: &Address) -> ReferralDataKey {
        ReferralDataKey::Registered(id.clone(), friend.clone())
    }

    fn approved_key(id: &Symbol, friend: &Address) -> ReferralDataKey {
        ReferralDataKey::Approved(id.clone(), friend.clone())
    }

    fn rewarded_key(id: &Symbol, friend: &Address) -> ReferralDataKey {
        ReferralDataKey::Rewarded(id.clone(), friend.clone())
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

    pub fn create_campaign(
        env: Env,
        id: Symbol,
        promoter: Address,
        title: String,
        reward_amount: i128,
        created_at: u64,
    ) {
        promoter.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, ReferralError::InvalidTitle);
        }
        if reward_amount <= 0 {
            panic_with_error!(&env, ReferralError::InvalidReward);
        }
        if created_at == 0 {
            panic_with_error!(&env, ReferralError::InvalidTimestamp);
        }

        let key = Self::campaign_key(&id);
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, ReferralError::AlreadyExists);
        }

        let campaign = Campaign {
            promoter,
            title,
            reward_amount,
            status: Symbol::new(&env, "open"),
            referral_count: 0,
            approved_count: 0,
            reward_count: 0,
            created_at,
        };

        env.storage().instance().set(&key, &campaign);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn register_referral(env: Env, id: Symbol, referrer: Address, friend: Address) {
        referrer.require_auth();

        let key = Self::campaign_key(&id);
        let maybe_campaign: Option<Campaign> = env.storage().instance().get(&key);

        if let Some(mut campaign) = maybe_campaign {
            let registered_key = Self::registered_key(&id, &friend);
            let already_registered: bool = env.storage().instance().get(&registered_key).unwrap_or(false);
            if already_registered {
                panic_with_error!(&env, ReferralError::AlreadyRegistered);
            }

            campaign.referral_count += 1;
            env.storage().instance().set(&key, &campaign);
            env.storage().instance().set(&registered_key, &true);
        } else {
            panic_with_error!(&env, ReferralError::NotFound);
        }
    }

    pub fn approve_referral(env: Env, id: Symbol, promoter: Address, friend: Address) {
        promoter.require_auth();

        let key = Self::campaign_key(&id);
        let maybe_campaign: Option<Campaign> = env.storage().instance().get(&key);

        if let Some(mut campaign) = maybe_campaign {
            if campaign.promoter != promoter {
                panic_with_error!(&env, ReferralError::Unauthorized);
            }

            let registered_key = Self::registered_key(&id, &friend);
            let is_registered: bool = env.storage().instance().get(&registered_key).unwrap_or(false);
            if !is_registered {
                panic_with_error!(&env, ReferralError::NotRegistered);
            }

            let approved_key = Self::approved_key(&id, &friend);
            let is_approved: bool = env.storage().instance().get(&approved_key).unwrap_or(false);
            if is_approved {
                panic_with_error!(&env, ReferralError::AlreadyApproved);
            }

            campaign.approved_count += 1;
            env.storage().instance().set(&key, &campaign);
            env.storage().instance().set(&approved_key, &true);
        } else {
            panic_with_error!(&env, ReferralError::NotFound);
        }
    }

    pub fn issue_reward(env: Env, id: Symbol, promoter: Address, friend: Address) {
        promoter.require_auth();

        let key = Self::campaign_key(&id);
        let maybe_campaign: Option<Campaign> = env.storage().instance().get(&key);

        if let Some(mut campaign) = maybe_campaign {
            if campaign.promoter != promoter {
                panic_with_error!(&env, ReferralError::Unauthorized);
            }

            let approved_key = Self::approved_key(&id, &friend);
            let is_approved: bool = env.storage().instance().get(&approved_key).unwrap_or(false);
            if !is_approved {
                panic_with_error!(&env, ReferralError::NotApproved);
            }

            let rewarded_key = Self::rewarded_key(&id, &friend);
            let already_rewarded: bool = env.storage().instance().get(&rewarded_key).unwrap_or(false);
            if already_rewarded {
                panic_with_error!(&env, ReferralError::AlreadyRewarded);
            }

            campaign.reward_count += 1;
            env.storage().instance().set(&key, &campaign);
            env.storage().instance().set(&rewarded_key, &true);

            let total_reward_count: u32 = env.storage().instance().get(&Self::reward_count_key()).unwrap_or(0);
            env.storage().instance().set(&Self::reward_count_key(), &(total_reward_count + 1));
        } else {
            panic_with_error!(&env, ReferralError::NotFound);
        }
    }

    pub fn get_referral(env: Env, id: Symbol) -> Option<Campaign> {
        env.storage().instance().get(&Self::campaign_key(&id))
    }

    pub fn list_referrals(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_reward_count(env: Env) -> u32 {
        env.storage().instance().get(&Self::reward_count_key()).unwrap_or(0)
    }
}
