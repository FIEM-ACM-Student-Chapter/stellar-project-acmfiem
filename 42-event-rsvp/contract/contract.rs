#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Event {
    pub host: Address,
    pub title: String,
    pub venue: String,
    pub capacity: u32,
    pub rsvp_count: u32,
    pub confirmed_count: u32,
    pub status: Symbol,
    pub event_time: u64,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum EventDataKey {
    IdList,
    Event(Symbol),
    Registered(Symbol, Address),
    Confirmed(Symbol, Address),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EventError {
    InvalidTitle = 1,
    InvalidCapacity = 2,
    InvalidTimestamp = 3,
    NotFound = 4,
    Unauthorized = 5,
    AlreadyExists = 6,
    RegistrationClosed = 7,
    CapacityReached = 8,
    AlreadyRegistered = 9,
    NotRegistered = 10,
    AlreadyConfirmed = 11,
}

#[contract]
pub struct EventRsvpContract;

#[contractimpl]
impl EventRsvpContract {
    fn ids_key() -> EventDataKey {
        EventDataKey::IdList
    }

    fn event_key(id: &Symbol) -> EventDataKey {
        EventDataKey::Event(id.clone())
    }

    fn registered_key(id: &Symbol, attendee: &Address) -> EventDataKey {
        EventDataKey::Registered(id.clone(), attendee.clone())
    }

    fn confirmed_key(id: &Symbol, attendee: &Address) -> EventDataKey {
        EventDataKey::Confirmed(id.clone(), attendee.clone())
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

    pub fn create_event(
        env: Env,
        id: Symbol,
        host: Address,
        title: String,
        venue: String,
        capacity: u32,
        event_time: u64,
    ) {
        host.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, EventError::InvalidTitle);
        }
        if capacity == 0 {
            panic_with_error!(&env, EventError::InvalidCapacity);
        }
        if event_time == 0 {
            panic_with_error!(&env, EventError::InvalidTimestamp);
        }

        let key = Self::event_key(&id);
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, EventError::AlreadyExists);
        }

        let event = Event {
            host,
            title,
            venue,
            capacity,
            rsvp_count: 0,
            confirmed_count: 0,
            status: Symbol::new(&env, "open"),
            event_time,
            created_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&key, &event);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn rsvp_event(env: Env, id: Symbol, attendee: Address) {
        attendee.require_auth();

        let key = Self::event_key(&id);
        let maybe_event: Option<Event> = env.storage().instance().get(&key);

        if let Some(mut event) = maybe_event {
            let open = Symbol::new(&env, "open");
            if event.status != open {
                panic_with_error!(&env, EventError::RegistrationClosed);
            }
            if event.rsvp_count >= event.capacity {
                panic_with_error!(&env, EventError::CapacityReached);
            }

            let registered_key = Self::registered_key(&id, &attendee);
            let already_registered: bool =
                env.storage().instance().get(&registered_key).unwrap_or(false);
            if already_registered {
                panic_with_error!(&env, EventError::AlreadyRegistered);
            }

            event.rsvp_count += 1;
            env.storage().instance().set(&key, &event);
            env.storage().instance().set(&registered_key, &true);
        } else {
            panic_with_error!(&env, EventError::NotFound);
        }
    }

    pub fn confirm_attendance(env: Env, id: Symbol, host: Address, attendee: Address) {
        host.require_auth();

        let key = Self::event_key(&id);
        let maybe_event: Option<Event> = env.storage().instance().get(&key);

        if let Some(mut event) = maybe_event {
            if event.host != host {
                panic_with_error!(&env, EventError::Unauthorized);
            }

            let registered_key = Self::registered_key(&id, &attendee);
            let is_registered: bool = env.storage().instance().get(&registered_key).unwrap_or(false);
            if !is_registered {
                panic_with_error!(&env, EventError::NotRegistered);
            }

            let confirmed_key = Self::confirmed_key(&id, &attendee);
            let is_confirmed: bool = env.storage().instance().get(&confirmed_key).unwrap_or(false);
            if is_confirmed {
                panic_with_error!(&env, EventError::AlreadyConfirmed);
            }

            event.confirmed_count += 1;
            env.storage().instance().set(&key, &event);
            env.storage().instance().set(&confirmed_key, &true);
        } else {
            panic_with_error!(&env, EventError::NotFound);
        }
    }

    pub fn close_event(env: Env, id: Symbol, host: Address) {
        host.require_auth();

        let key = Self::event_key(&id);
        let maybe_event: Option<Event> = env.storage().instance().get(&key);

        if let Some(mut event) = maybe_event {
            if event.host != host {
                panic_with_error!(&env, EventError::Unauthorized);
            }

            let open = Symbol::new(&env, "open");
            if event.status != open {
                panic_with_error!(&env, EventError::RegistrationClosed);
            }

            event.status = Symbol::new(&env, "closed");
            env.storage().instance().set(&key, &event);
        } else {
            panic_with_error!(&env, EventError::NotFound);
        }
    }

    pub fn get_event(env: Env, id: Symbol) -> Option<Event> {
        env.storage().instance().get(&Self::event_key(&id))
    }

    pub fn list_events(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_rsvp_count(env: Env, id: Symbol) -> u32 {
        let maybe_event: Option<Event> = env.storage().instance().get(&Self::event_key(&id));
        if let Some(event) = maybe_event {
            event.rsvp_count
        } else {
            0
        }
    }
}
