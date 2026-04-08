#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Campaign {
    pub organizer: Address,
    pub title: String,
    pub description: String,
    pub goal_amount: i128,
    pub raised_amount: i128,
    pub donor_count: u32,
    pub is_closed: bool,
    pub created_at: u64,
    pub deadline: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct Donation {
    pub amount: i128,
    pub message: String,
    pub donated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    CampaignList,
    Campaign(Symbol),
    DonationRecord(Symbol, Address),
    DonorCount(Symbol),
    TotalRaised(Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FundraisingError {
    CampaignNotFound = 1,
    CampaignAlreadyExists = 2,
    CampaignClosed = 3,
    NotOrganizer = 4,
    InvalidTitle = 5,
    InvalidGoalAmount = 6,
    InvalidDonationAmount = 7,
    AlreadyDonated = 8,
}

#[contract]
pub struct DonationFundraisingContract;

#[contractimpl]
impl DonationFundraisingContract {
    fn load_ids(env: &Env) -> Vec<Symbol> {
        env.storage()
            .instance()
            .get(&DataKey::CampaignList)
            .unwrap_or(Vec::new(env))
    }

    fn save_ids(env: &Env, ids: &Vec<Symbol>) {
        env.storage().instance().set(&DataKey::CampaignList, ids);
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
        organizer: Address,
        title: String,
        description: String,
        goal_amount: i128,
        deadline: u64,
    ) {
        organizer.require_auth();

        if title.len() == 0 {
            panic_with_error!(env, FundraisingError::InvalidTitle);
        }
        if goal_amount <= 0 {
            panic_with_error!(env, FundraisingError::InvalidGoalAmount);
        }

        let key = DataKey::Campaign(id.clone());
        if env.storage().instance().has(&key) {
            panic_with_error!(env, FundraisingError::CampaignAlreadyExists);
        }

        let campaign = Campaign {
            organizer,
            title,
            description,
            goal_amount,
            raised_amount: 0,
            donor_count: 0,
            is_closed: false,
            created_at: env.ledger().timestamp(),
            deadline,
        };

        env.storage().instance().set(&key, &campaign);
        env.storage()
            .instance()
            .set(&DataKey::DonorCount(id.clone()), &0u32);
        env.storage()
            .instance()
            .set(&DataKey::TotalRaised(id.clone()), &0i128);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn donate(
        env: Env,
        campaign_id: Symbol,
        donor: Address,
        amount: i128,
        message: String,
    ) {
        donor.require_auth();

        if amount <= 0 {
            panic_with_error!(env, FundraisingError::InvalidDonationAmount);
        }

        let key = DataKey::Campaign(campaign_id.clone());
        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, FundraisingError::CampaignNotFound));

        if campaign.is_closed {
            panic_with_error!(env, FundraisingError::CampaignClosed);
        }

        let donation_key = DataKey::DonationRecord(campaign_id.clone(), donor.clone());
        if env.storage().instance().has(&donation_key) {
            panic_with_error!(env, FundraisingError::AlreadyDonated);
        }

        let donation = Donation {
            amount,
            message,
            donated_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&donation_key, &donation);

        campaign.raised_amount += amount;
        campaign.donor_count += 1;
        env.storage().instance().set(&key, &campaign);

        let raised_key = DataKey::TotalRaised(campaign_id.clone());
        let total: i128 = env.storage().instance().get(&raised_key).unwrap_or(0);
        env.storage().instance().set(&raised_key, &(total + amount));

        let count_key = DataKey::DonorCount(campaign_id);
        let count: u32 = env.storage().instance().get(&count_key).unwrap_or(0);
        env.storage().instance().set(&count_key, &(count + 1));
    }

    pub fn close_campaign(env: Env, id: Symbol, organizer: Address) {
        organizer.require_auth();

        let key = DataKey::Campaign(id.clone());
        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, FundraisingError::CampaignNotFound));

        if campaign.organizer != organizer {
            panic_with_error!(env, FundraisingError::NotOrganizer);
        }

        campaign.is_closed = true;
        env.storage().instance().set(&key, &campaign);
    }

    pub fn get_campaign(env: Env, id: Symbol) -> Option<Campaign> {
        env.storage().instance().get(&DataKey::Campaign(id))
    }

    pub fn list_campaigns(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_donor_count(env: Env, campaign_id: Symbol) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::DonorCount(campaign_id))
            .unwrap_or(0)
    }

    pub fn get_total_raised(env: Env, campaign_id: Symbol) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalRaised(campaign_id))
            .unwrap_or(0)
    }
}
