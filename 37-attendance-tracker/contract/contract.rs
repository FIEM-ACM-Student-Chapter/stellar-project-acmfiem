#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Session {
    pub organizer: Address,
    pub title: String,
    pub location: String,
    pub status: Symbol,
    pub attendee_count: u32,
    pub session_time: u64,
    pub created_at: u64,
    pub closed_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum SessionDataKey {
    IdList,
    Session(Symbol),
    CheckedIn(Symbol, Address),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AttendanceError {
    InvalidTitle = 1,
    InvalidTimestamp = 2,
    NotFound = 3,
    Unauthorized = 4,
    AlreadyExists = 5,
    SessionClosed = 6,
    AlreadyCheckedIn = 7,
}

#[contract]
pub struct AttendanceTrackerContract;

#[contractimpl]
impl AttendanceTrackerContract {
    fn ids_key() -> SessionDataKey {
        SessionDataKey::IdList
    }

    fn session_key(id: &Symbol) -> SessionDataKey {
        SessionDataKey::Session(id.clone())
    }

    fn checked_in_key(id: &Symbol, attendee: &Address) -> SessionDataKey {
        SessionDataKey::CheckedIn(id.clone(), attendee.clone())
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

    pub fn create_session(
        env: Env,
        id: Symbol,
        organizer: Address,
        title: String,
        location: String,
        session_time: u64,
    ) {
        organizer.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, AttendanceError::InvalidTitle);
        }
        if session_time == 0 {
            panic_with_error!(&env, AttendanceError::InvalidTimestamp);
        }

        let key = Self::session_key(&id);
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, AttendanceError::AlreadyExists);
        }

        let session = Session {
            organizer,
            title,
            location,
            status: Symbol::new(&env, "open"),
            attendee_count: 0,
            session_time,
            created_at: env.ledger().timestamp(),
            closed_at: 0,
        };

        env.storage().instance().set(&key, &session);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn check_in(env: Env, id: Symbol, attendee: Address) {
        attendee.require_auth();

        let key = Self::session_key(&id);
        let maybe_session: Option<Session> = env.storage().instance().get(&key);

        if let Some(mut session) = maybe_session {
            let open = Symbol::new(&env, "open");
            if session.status != open {
                panic_with_error!(&env, AttendanceError::SessionClosed);
            }

            let checked_in_key = Self::checked_in_key(&id, &attendee);
            let already_checked_in: bool =
                env.storage().instance().get(&checked_in_key).unwrap_or(false);
            if already_checked_in {
                panic_with_error!(&env, AttendanceError::AlreadyCheckedIn);
            }

            session.attendee_count += 1;
            env.storage().instance().set(&key, &session);
            env.storage().instance().set(&checked_in_key, &true);
        } else {
            panic_with_error!(&env, AttendanceError::NotFound);
        }
    }

    pub fn close_session(env: Env, id: Symbol, organizer: Address) {
        organizer.require_auth();

        let key = Self::session_key(&id);
        let maybe_session: Option<Session> = env.storage().instance().get(&key);

        if let Some(mut session) = maybe_session {
            if session.organizer != organizer {
                panic_with_error!(&env, AttendanceError::Unauthorized);
            }

            let open = Symbol::new(&env, "open");
            if session.status != open {
                panic_with_error!(&env, AttendanceError::SessionClosed);
            }

            session.status = Symbol::new(&env, "closed");
            session.closed_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &session);
        } else {
            panic_with_error!(&env, AttendanceError::NotFound);
        }
    }

    pub fn get_session(env: Env, id: Symbol) -> Option<Session> {
        env.storage().instance().get(&Self::session_key(&id))
    }

    pub fn list_sessions(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_attendee_count(env: Env, id: Symbol) -> u32 {
        let maybe_session: Option<Session> = env.storage().instance().get(&Self::session_key(&id));
        if let Some(session) = maybe_session {
            session.attendee_count
        } else {
            0
        }
    }
}
