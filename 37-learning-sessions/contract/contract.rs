#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Session {
    pub tutor: Address,
    pub subject: String,
    pub description: String,
    pub session_date: u64,
    pub duration_mins: u32,
    pub price: i128,
    pub max_attendees: u32,
    pub booked_count: u32,
    pub status: Symbol,
    pub total_rating: u32,
    pub rating_count: u32,
    pub total_earned: i128,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum LearningDataKey {
    SessionList,
    Session(Symbol),
    Booked(Symbol, Address),
    Rated(Symbol, Address),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum LearningError {
    SubjectEmpty = 1,
    InvalidPrice = 2,
    SessionNotFound = 3,
    SessionFull = 4,
    InsufficientPayment = 5,
    NotTutor = 6,
    InvalidStatus = 7,
    InvalidRating = 8,
    AlreadyBooked = 9,
    AlreadyRated = 10,
    NotBooked = 11,
}

#[contract]
pub struct LearningSessionsContract;

#[contractimpl]
impl LearningSessionsContract {
    fn session_key(id: &Symbol) -> LearningDataKey {
        LearningDataKey::Session(id.clone())
    }

    fn list_key() -> LearningDataKey {
        LearningDataKey::SessionList
    }

    fn booked_key(session_id: &Symbol, student: &Address) -> LearningDataKey {
        LearningDataKey::Booked(session_id.clone(), student.clone())
    }

    fn rated_key(session_id: &Symbol, student: &Address) -> LearningDataKey {
        LearningDataKey::Rated(session_id.clone(), student.clone())
    }

    fn load_ids(env: &Env) -> Vec<Symbol> {
        env.storage().instance().get(&Self::list_key()).unwrap_or(Vec::new(env))
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
        tutor: Address,
        subject: String,
        description: String,
        session_date: u64,
        duration_mins: u32,
        price: i128,
        max_attendees: u32,
    ) {
        tutor.require_auth();

        if subject.len() == 0 {
            panic_with_error!(&env, LearningError::SubjectEmpty);
        }
        if price < 0 {
            panic_with_error!(&env, LearningError::InvalidPrice);
        }

        let session = Session {
            tutor,
            subject,
            description,
            session_date,
            duration_mins,
            price,
            max_attendees,
            booked_count: 0,
            status: Symbol::new(&env, "scheduled"),
            total_rating: 0,
            rating_count: 0,
            total_earned: 0,
            created_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&Self::session_key(&id), &session);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            env.storage().instance().set(&Self::list_key(), &ids);
        }
    }

    pub fn book_session(env: Env, session_id: Symbol, student: Address, payment_amount: i128) {
        student.require_auth();

        let key = Self::session_key(&session_id);
        let maybe_session: Option<Session> = env.storage().instance().get(&key);
        if maybe_session.is_none() {
            panic_with_error!(&env, LearningError::SessionNotFound);
        }
        let mut session = maybe_session.unwrap();

        let bk = Self::booked_key(&session_id, &student);
        let already: bool = env.storage().instance().get(&bk).unwrap_or(false);
        if already {
            panic_with_error!(&env, LearningError::AlreadyBooked);
        }

        if session.booked_count >= session.max_attendees {
            panic_with_error!(&env, LearningError::SessionFull);
        }
        if payment_amount < session.price {
            panic_with_error!(&env, LearningError::InsufficientPayment);
        }

        session.booked_count += 1;
        session.total_earned += payment_amount;
        env.storage().instance().set(&key, &session);
        env.storage().instance().set(&bk, &true);
    }

    pub fn start_session(env: Env, id: Symbol, tutor: Address) {
        tutor.require_auth();
        let key = Self::session_key(&id);
        let maybe_session: Option<Session> = env.storage().instance().get(&key);
        if maybe_session.is_none() {
            panic_with_error!(&env, LearningError::SessionNotFound);
        }
        let mut session = maybe_session.unwrap();
        session.status = Symbol::new(&env, "in_progress");
        env.storage().instance().set(&key, &session);
    }

    pub fn complete_session(env: Env, id: Symbol, tutor: Address) {
        tutor.require_auth();
        let key = Self::session_key(&id);
        let maybe_session: Option<Session> = env.storage().instance().get(&key);
        if maybe_session.is_none() {
            panic_with_error!(&env, LearningError::SessionNotFound);
        }
        let mut session = maybe_session.unwrap();
        session.status = Symbol::new(&env, "completed");
        env.storage().instance().set(&key, &session);
    }

    pub fn cancel_session(env: Env, id: Symbol, tutor: Address) {
        tutor.require_auth();
        let key = Self::session_key(&id);
        let maybe_session: Option<Session> = env.storage().instance().get(&key);
        if maybe_session.is_none() {
            panic_with_error!(&env, LearningError::SessionNotFound);
        }
        let mut session = maybe_session.unwrap();
        session.status = Symbol::new(&env, "cancelled");
        env.storage().instance().set(&key, &session);
    }

    pub fn rate_session(env: Env, id: Symbol, student: Address, rating: u32) {
        student.require_auth();

        if rating < 1 || rating > 5 {
            panic_with_error!(&env, LearningError::InvalidRating);
        }

        let key = Self::session_key(&id);
        let maybe_session: Option<Session> = env.storage().instance().get(&key);
        if maybe_session.is_none() {
            panic_with_error!(&env, LearningError::SessionNotFound);
        }
        let mut session = maybe_session.unwrap();

        let bk = Self::booked_key(&id, &student);
        let booked: bool = env.storage().instance().get(&bk).unwrap_or(false);
        if !booked {
            panic_with_error!(&env, LearningError::NotBooked);
        }

        let rk = Self::rated_key(&id, &student);
        let already_rated: bool = env.storage().instance().get(&rk).unwrap_or(false);
        if already_rated {
            panic_with_error!(&env, LearningError::AlreadyRated);
        }

        session.total_rating += rating;
        session.rating_count += 1;
        env.storage().instance().set(&key, &session);
        env.storage().instance().set(&rk, &true);
    }

    pub fn get_session(env: Env, id: Symbol) -> Option<Session> {
        env.storage().instance().get(&Self::session_key(&id))
    }

    pub fn list_sessions(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }
}
