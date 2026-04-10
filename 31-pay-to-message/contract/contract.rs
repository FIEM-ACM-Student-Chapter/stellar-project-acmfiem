#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Message {
    pub sender: Address,
    pub recipient: Address,
    pub content: String,
    pub payment: i128,
    pub is_read: bool,
    pub sent_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum PayToMessageDataKey {
    MessageList,
    Message(Symbol),
    Inbox(Address),
    MessageRate(Address),
    Earnings(Address),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum PayToMessageError {
    ContentEmpty = 1,
    InsufficientPayment = 2,
    MessageNotFound = 3,
    InvalidRate = 4,
    InvalidTimestamp = 5,
}

#[contract]
pub struct PayToMessageContract;

#[contractimpl]
impl PayToMessageContract {
    fn msg_key(id: &Symbol) -> PayToMessageDataKey {
        PayToMessageDataKey::Message(id.clone())
    }

    fn list_key() -> PayToMessageDataKey {
        PayToMessageDataKey::MessageList
    }

    fn inbox_key(recipient: &Address) -> PayToMessageDataKey {
        PayToMessageDataKey::Inbox(recipient.clone())
    }

    fn rate_key(recipient: &Address) -> PayToMessageDataKey {
        PayToMessageDataKey::MessageRate(recipient.clone())
    }

    fn earnings_key(recipient: &Address) -> PayToMessageDataKey {
        PayToMessageDataKey::Earnings(recipient.clone())
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

    pub fn set_rate(env: Env, recipient: Address, rate_per_message: i128) {
        recipient.require_auth();
        if rate_per_message < 0 {
            panic_with_error!(&env, PayToMessageError::InvalidRate);
        }
        env.storage().instance().set(&Self::rate_key(&recipient), &rate_per_message);
    }

    pub fn send_message(
        env: Env,
        id: Symbol,
        sender: Address,
        recipient: Address,
        content: String,
        payment_amount: i128,
    ) {
        sender.require_auth();

        if content.len() == 0 {
            panic_with_error!(&env, PayToMessageError::ContentEmpty);
        }

        let rate: i128 = env.storage().instance().get(&Self::rate_key(&recipient)).unwrap_or(0);
        if payment_amount < rate {
            panic_with_error!(&env, PayToMessageError::InsufficientPayment);
        }

        let sent_at = env.ledger().timestamp();

        let message = Message {
            sender,
            recipient: recipient.clone(),
            content,
            payment: payment_amount,
            is_read: false,
            sent_at,
        };

        env.storage().instance().set(&Self::msg_key(&id), &message);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id.clone());
            env.storage().instance().set(&Self::list_key(), &ids);
        }

        let mut inbox: Vec<Symbol> = env.storage().instance().get(&Self::inbox_key(&recipient)).unwrap_or(Vec::new(&env));
        if !Self::has_id(&inbox, &id) {
            inbox.push_back(id);
            env.storage().instance().set(&Self::inbox_key(&recipient), &inbox);
        }

        let earnings: i128 = env.storage().instance().get(&Self::earnings_key(&recipient)).unwrap_or(0);
        env.storage().instance().set(&Self::earnings_key(&recipient), &(earnings + payment_amount));
    }

    pub fn read_message(env: Env, id: Symbol, recipient: Address) -> bool {
        recipient.require_auth();
        let key = Self::msg_key(&id);
        let maybe_msg: Option<Message> = env.storage().instance().get(&key);
        if let Some(mut msg) = maybe_msg {
            msg.is_read = true;
            env.storage().instance().set(&key, &msg);
            true
        } else {
            false
        }
    }

    pub fn get_message(env: Env, id: Symbol) -> Option<Message> {
        env.storage().instance().get(&Self::msg_key(&id))
    }

    pub fn list_inbox(env: Env, recipient: Address) -> Vec<Symbol> {
        env.storage().instance().get(&Self::inbox_key(&recipient)).unwrap_or(Vec::new(&env))
    }

    pub fn get_rate(env: Env, recipient: Address) -> i128 {
        env.storage().instance().get(&Self::rate_key(&recipient)).unwrap_or(0)
    }

    pub fn get_earnings(env: Env, recipient: Address) -> i128 {
        env.storage().instance().get(&Self::earnings_key(&recipient)).unwrap_or(0)
    }
}
