#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Complaint {
    pub reporter: Address,
    pub assignee: Address,
    pub has_assignee: bool,
    pub subject: String,
    pub description: String,
    pub category: Symbol,
    pub severity: u32,
    pub status: Symbol,
    pub resolution: String,
    pub filed_at: u64,
    pub resolved_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum ComplaintDataKey {
    IdList,
    Complaint(Symbol),
    Count,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ComplaintError {
    InvalidSubject = 1,
    InvalidTimestamp = 2,
    NotFound = 3,
    AlreadyExists = 4,
    Unauthorized = 5,
    AlreadyResolved = 6,
    NotAssigned = 7,
    MaxSeverity = 8,
}

#[contract]
pub struct ComplaintReportingContract;

#[contractimpl]
impl ComplaintReportingContract {
    fn complaint_key(id: &Symbol) -> ComplaintDataKey {
        ComplaintDataKey::Complaint(id.clone())
    }

    fn load_ids(env: &Env) -> Vec<Symbol> {
        env.storage().instance().get(&ComplaintDataKey::IdList).unwrap_or(Vec::new(env))
    }

    fn save_ids(env: &Env, ids: &Vec<Symbol>) {
        env.storage().instance().set(&ComplaintDataKey::IdList, ids);
    }

    pub fn file_complaint(
        env: Env,
        id: Symbol,
        reporter: Address,
        subject: String,
        description: String,
        category: Symbol,
        severity: u32,
    ) {
        reporter.require_auth();

        if subject.len() == 0 {
            panic_with_error!(&env, ComplaintError::InvalidSubject);
        }

        let key = Self::complaint_key(&id);
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, ComplaintError::AlreadyExists);
        }

        let open_status = Symbol::new(&env, "open");
        let empty_resolution = String::from_str(&env, "");
        let filed_at = env.ledger().timestamp();

        let complaint = Complaint {
            reporter: reporter.clone(),
            assignee: reporter,
            has_assignee: false,
            subject,
            description,
            category,
            severity,
            status: open_status,
            resolution: empty_resolution,
            filed_at,
            resolved_at: 0,
        };

        env.storage().instance().set(&key, &complaint);

        let mut ids = Self::load_ids(&env);
        ids.push_back(id);
        Self::save_ids(&env, &ids);

        let count: u32 = env.storage().instance().get(&ComplaintDataKey::Count).unwrap_or(0);
        env.storage().instance().set(&ComplaintDataKey::Count, &(count + 1));
    }

    pub fn assign_complaint(env: Env, id: Symbol, admin: Address, assignee: Address) {
        admin.require_auth();

        let key = Self::complaint_key(&id);
        let maybe: Option<Complaint> = env.storage().instance().get(&key);

        if let Some(mut complaint) = maybe {
            let resolved = Symbol::new(&env, "resolved");
            if complaint.status == resolved {
                panic_with_error!(&env, ComplaintError::AlreadyResolved);
            }

            let assigned = Symbol::new(&env, "assigned");
            complaint.assignee = assignee;
            complaint.has_assignee = true;
            complaint.status = assigned;

            env.storage().instance().set(&key, &complaint);
        } else {
            panic_with_error!(&env, ComplaintError::NotFound);
        }
    }

    pub fn resolve_complaint(env: Env, id: Symbol, handler: Address, resolution_notes: String) {
        handler.require_auth();

        let key = Self::complaint_key(&id);
        let maybe: Option<Complaint> = env.storage().instance().get(&key);

        if let Some(mut complaint) = maybe {
            let resolved_status = Symbol::new(&env, "resolved");
            if complaint.status == resolved_status {
                panic_with_error!(&env, ComplaintError::AlreadyResolved);
            }
            if !complaint.has_assignee {
                panic_with_error!(&env, ComplaintError::NotAssigned);
            }
            if complaint.assignee != handler {
                panic_with_error!(&env, ComplaintError::Unauthorized);
            }

            complaint.status = resolved_status;
            complaint.resolution = resolution_notes;
            complaint.resolved_at = env.ledger().timestamp();

            env.storage().instance().set(&key, &complaint);
        } else {
            panic_with_error!(&env, ComplaintError::NotFound);
        }
    }

    pub fn escalate_complaint(env: Env, id: Symbol, reporter: Address) {
        reporter.require_auth();

        let key = Self::complaint_key(&id);
        let maybe: Option<Complaint> = env.storage().instance().get(&key);

        if let Some(mut complaint) = maybe {
            if complaint.reporter != reporter {
                panic_with_error!(&env, ComplaintError::Unauthorized);
            }

            let resolved = Symbol::new(&env, "resolved");
            if complaint.status == resolved {
                panic_with_error!(&env, ComplaintError::AlreadyResolved);
            }

            if complaint.severity >= 5 {
                panic_with_error!(&env, ComplaintError::MaxSeverity);
            }

            let escalated = Symbol::new(&env, "escalated");
            complaint.severity += 1;
            complaint.status = escalated;

            env.storage().instance().set(&key, &complaint);
        } else {
            panic_with_error!(&env, ComplaintError::NotFound);
        }
    }

    pub fn get_complaint(env: Env, id: Symbol) -> Option<Complaint> {
        env.storage().instance().get(&Self::complaint_key(&id))
    }

    pub fn list_complaints(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_complaint_count(env: Env) -> u32 {
        env.storage().instance().get(&ComplaintDataKey::Count).unwrap_or(0)
    }
}
