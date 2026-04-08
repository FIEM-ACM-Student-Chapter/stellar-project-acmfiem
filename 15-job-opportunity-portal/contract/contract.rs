#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Job {
    pub employer: Address,
    pub title: String,
    pub description: String,
    pub location: String,
    pub salary_min: i128,
    pub salary_max: i128,
    pub job_type: Symbol,
    pub applicant_count: u32,
    pub is_open: bool,
    pub posted_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct Application {
    pub cover_letter: String,
    pub applied_at: u64,
    pub is_hired: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    JobList,
    Job(Symbol),
    Application(Symbol, Address),
    ApplicationCount(Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum JobPortalError {
    JobNotFound = 1,
    JobAlreadyExists = 2,
    JobClosed = 3,
    NotEmployer = 4,
    InvalidTitle = 5,
    InvalidSalaryRange = 6,
    AlreadyApplied = 7,
    ApplicationNotFound = 8,
}

#[contract]
pub struct JobOpportunityPortalContract;

#[contractimpl]
impl JobOpportunityPortalContract {
    fn load_ids(env: &Env) -> Vec<Symbol> {
        env.storage()
            .instance()
            .get(&DataKey::JobList)
            .unwrap_or(Vec::new(env))
    }

    fn save_ids(env: &Env, ids: &Vec<Symbol>) {
        env.storage().instance().set(&DataKey::JobList, ids);
    }

    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool {
        for current in ids.iter() {
            if current == id.clone() {
                return true;
            }
        }
        false
    }

    pub fn post_job(
        env: Env,
        id: Symbol,
        employer: Address,
        title: String,
        description: String,
        location: String,
        salary_min: i128,
        salary_max: i128,
        job_type: Symbol,
    ) {
        employer.require_auth();

        if title.len() == 0 {
            panic_with_error!(env, JobPortalError::InvalidTitle);
        }
        if salary_min > salary_max {
            panic_with_error!(env, JobPortalError::InvalidSalaryRange);
        }

        let key = DataKey::Job(id.clone());
        if env.storage().instance().has(&key) {
            panic_with_error!(env, JobPortalError::JobAlreadyExists);
        }

        let job = Job {
            employer,
            title,
            description,
            location,
            salary_min,
            salary_max,
            job_type,
            applicant_count: 0,
            is_open: true,
            posted_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&key, &job);
        env.storage()
            .instance()
            .set(&DataKey::ApplicationCount(id.clone()), &0u32);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn apply_job(
        env: Env,
        job_id: Symbol,
        applicant: Address,
        cover_letter: String,
    ) {
        applicant.require_auth();

        let key = DataKey::Job(job_id.clone());
        let mut job: Job = env
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, JobPortalError::JobNotFound));

        if !job.is_open {
            panic_with_error!(env, JobPortalError::JobClosed);
        }

        let app_key = DataKey::Application(job_id.clone(), applicant);
        if env.storage().instance().has(&app_key) {
            panic_with_error!(env, JobPortalError::AlreadyApplied);
        }

        let application = Application {
            cover_letter,
            applied_at: env.ledger().timestamp(),
            is_hired: false,
        };

        env.storage().instance().set(&app_key, &application);

        job.applicant_count += 1;
        env.storage().instance().set(&key, &job);

        let count_key = DataKey::ApplicationCount(job_id);
        let count: u32 = env.storage().instance().get(&count_key).unwrap_or(0);
        env.storage().instance().set(&count_key, &(count + 1));
    }

    pub fn close_job(env: Env, id: Symbol, employer: Address) {
        employer.require_auth();

        let key = DataKey::Job(id.clone());
        let mut job: Job = env
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, JobPortalError::JobNotFound));

        if job.employer != employer {
            panic_with_error!(env, JobPortalError::NotEmployer);
        }

        job.is_open = false;
        env.storage().instance().set(&key, &job);
    }

    pub fn hire_applicant(
        env: Env,
        job_id: Symbol,
        employer: Address,
        applicant: Address,
    ) {
        employer.require_auth();

        let key = DataKey::Job(job_id.clone());
        let job: Job = env
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, JobPortalError::JobNotFound));

        if job.employer != employer {
            panic_with_error!(env, JobPortalError::NotEmployer);
        }

        let app_key = DataKey::Application(job_id, applicant);
        let mut application: Application = env
            .storage()
            .instance()
            .get(&app_key)
            .unwrap_or_else(|| panic_with_error!(env, JobPortalError::ApplicationNotFound));

        application.is_hired = true;
        env.storage().instance().set(&app_key, &application);
    }

    pub fn get_job(env: Env, id: Symbol) -> Option<Job> {
        env.storage().instance().get(&DataKey::Job(id))
    }

    pub fn list_jobs(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_application_count(env: Env, job_id: Symbol) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::ApplicationCount(job_id))
            .unwrap_or(0)
    }
}
