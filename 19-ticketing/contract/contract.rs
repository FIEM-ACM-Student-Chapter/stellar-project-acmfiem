#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Ticket {
    pub reporter: Address,
    pub assignee: Address,
    pub subject: String,
    pub description: String,
    pub category: Symbol,
    pub priority: u32,
    pub response_count: u32,
    pub status: Symbol,
    pub created_at: u64,
    pub closed_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IdList,
    Ticket(Symbol),
    OpenCount,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TicketError {
    NotFound = 1,
    InvalidSubject = 2,
    InvalidStatus = 3,
    NotReporter = 4,
    AlreadyExists = 5,
    InvalidPriority = 6,
    AlreadyClosed = 7,
}

#[contract]
pub struct TicketingContract;

#[contractimpl]
impl TicketingContract {
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

    fn status_open(env: &Env) -> Symbol {
        Symbol::new(env, "open")
    }

    fn status_assigned(env: &Env) -> Symbol {
        Symbol::new(env, "assigned")
    }

    fn status_in_progress(env: &Env) -> Symbol {
        Symbol::new(env, "in_progress")
    }

    fn status_closed(env: &Env) -> Symbol {
        Symbol::new(env, "closed")
    }

    fn status_reopened(env: &Env) -> Symbol {
        Symbol::new(env, "reopened")
    }

    fn increment_open(env: &Env) {
        let count: u32 = env.storage().instance().get(&DataKey::OpenCount).unwrap_or(0);
        env.storage().instance().set(&DataKey::OpenCount, &(count + 1));
    }

    fn decrement_open(env: &Env) {
        let count: u32 = env.storage().instance().get(&DataKey::OpenCount).unwrap_or(0);
        if count > 0 {
            env.storage().instance().set(&DataKey::OpenCount, &(count - 1));
        }
    }

    pub fn create_ticket(
        env: Env,
        id: Symbol,
        reporter: Address,
        subject: String,
        description: String,
        category: Symbol,
        priority: u32,
    ) {
        reporter.require_auth();

        if subject.len() == 0 {
            panic_with_error!(&env, TicketError::InvalidSubject);
        }
        if priority < 1 || priority > 5 {
            panic_with_error!(&env, TicketError::InvalidPriority);
        }

        let key = DataKey::Ticket(id.clone());
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, TicketError::AlreadyExists);
        }

        let ticket = Ticket {
            reporter: reporter.clone(),
            assignee: reporter,
            subject,
            description,
            category,
            priority,
            response_count: 0,
            status: Self::status_open(&env),
            created_at: env.ledger().timestamp(),
            closed_at: 0,
        };

        env.storage().instance().set(&key, &ticket);
        Self::increment_open(&env);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn assign_ticket(env: Env, id: Symbol, admin: Address, assignee: Address) {
        admin.require_auth();

        let key = DataKey::Ticket(id.clone());
        let maybe: Option<Ticket> = env.storage().instance().get(&key);

        if let Some(mut ticket) = maybe {
            let closed = Self::status_closed(&env);
            if ticket.status == closed {
                panic_with_error!(&env, TicketError::AlreadyClosed);
            }
            ticket.assignee = assignee;
            ticket.status = Self::status_assigned(&env);
            env.storage().instance().set(&key, &ticket);
        } else {
            panic_with_error!(&env, TicketError::NotFound);
        }
    }

    pub fn add_response(env: Env, id: Symbol, responder: Address, _message: String) {
        responder.require_auth();

        let key = DataKey::Ticket(id.clone());
        let maybe: Option<Ticket> = env.storage().instance().get(&key);

        if let Some(mut ticket) = maybe {
            let closed = Self::status_closed(&env);
            if ticket.status == closed {
                panic_with_error!(&env, TicketError::AlreadyClosed);
            }
            ticket.response_count += 1;
            let assigned = Self::status_assigned(&env);
            if ticket.status == assigned {
                ticket.status = Self::status_in_progress(&env);
            }
            env.storage().instance().set(&key, &ticket);
        } else {
            panic_with_error!(&env, TicketError::NotFound);
        }
    }

    pub fn close_ticket(env: Env, id: Symbol, closer: Address) {
        closer.require_auth();

        let key = DataKey::Ticket(id.clone());
        let maybe: Option<Ticket> = env.storage().instance().get(&key);

        if let Some(mut ticket) = maybe {
            let closed = Self::status_closed(&env);
            if ticket.status == closed {
                panic_with_error!(&env, TicketError::AlreadyClosed);
            }
            ticket.status = Self::status_closed(&env);
            ticket.closed_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &ticket);
            Self::decrement_open(&env);
        } else {
            panic_with_error!(&env, TicketError::NotFound);
        }
    }

    pub fn reopen_ticket(env: Env, id: Symbol, reporter: Address) {
        reporter.require_auth();

        let key = DataKey::Ticket(id.clone());
        let maybe: Option<Ticket> = env.storage().instance().get(&key);

        if let Some(mut ticket) = maybe {
            if ticket.reporter != reporter {
                panic_with_error!(&env, TicketError::NotReporter);
            }
            let closed = Self::status_closed(&env);
            if ticket.status != closed {
                panic_with_error!(&env, TicketError::InvalidStatus);
            }
            ticket.status = Self::status_reopened(&env);
            ticket.closed_at = 0;
            env.storage().instance().set(&key, &ticket);
            Self::increment_open(&env);
        } else {
            panic_with_error!(&env, TicketError::NotFound);
        }
    }

    pub fn get_ticket(env: Env, id: Symbol) -> Option<Ticket> {
        env.storage().instance().get(&DataKey::Ticket(id))
    }

    pub fn list_tickets(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_open_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::OpenCount).unwrap_or(0)
    }
}
