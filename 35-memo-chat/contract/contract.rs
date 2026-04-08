#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Memo {
    pub sender: Address,
    pub channel: Symbol,
    pub content: String,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct Channel {
    pub creator: Address,
    pub channel_name: String,
    pub description: String,
    pub member_count: u32,
    pub message_count: u32,
    pub is_public: bool,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum MemoChatDataKey {
    MemoList,
    Memo(Symbol),
    ChannelList,
    Channel(Symbol),
    ChannelMembers(Symbol),
    ChannelMsgCount(Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MemoChatError {
    ContentEmpty = 1,
    InvalidTimestamp = 2,
    ChannelNotFound = 3,
    NotAMember = 4,
    ChannelNameEmpty = 5,
    AlreadyMember = 6,
}

#[contract]
pub struct MemoChatContract;

#[contractimpl]
impl MemoChatContract {
    fn memo_key(id: &Symbol) -> MemoChatDataKey {
        MemoChatDataKey::Memo(id.clone())
    }

    fn memo_list_key() -> MemoChatDataKey {
        MemoChatDataKey::MemoList
    }

    fn channel_key(id: &Symbol) -> MemoChatDataKey {
        MemoChatDataKey::Channel(id.clone())
    }

    fn channel_list_key() -> MemoChatDataKey {
        MemoChatDataKey::ChannelList
    }

    fn channel_members_key(id: &Symbol) -> MemoChatDataKey {
        MemoChatDataKey::ChannelMembers(id.clone())
    }

    fn load_ids(env: &Env, key: &MemoChatDataKey) -> Vec<Symbol> {
        env.storage().instance().get(key).unwrap_or(Vec::new(env))
    }

    fn has_id(ids: &Vec<Symbol>, id: &Symbol) -> bool {
        for current in ids.iter() {
            if current == id.clone() {
                return true;
            }
        }
        false
    }

    pub fn create_channel(
        env: Env,
        id: Symbol,
        creator: Address,
        channel_name: String,
        description: String,
        is_public: bool,
    ) {
        creator.require_auth();

        if channel_name.len() == 0 {
            panic_with_error!(&env, MemoChatError::ChannelNameEmpty);
        }

        let channel = Channel {
            creator: creator.clone(),
            channel_name,
            description,
            member_count: 1,
            message_count: 0,
            is_public,
            created_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&Self::channel_key(&id), &channel);

        let mut channels = Self::load_ids(&env, &Self::channel_list_key());
        if !Self::has_id(&channels, &id) {
            channels.push_back(id.clone());
            env.storage().instance().set(&Self::channel_list_key(), &channels);
        }

        let mut members: Vec<Address> = Vec::new(&env);
        members.push_back(creator);
        env.storage().instance().set(&Self::channel_members_key(&id), &members);
    }

    pub fn join_channel(env: Env, channel_id: Symbol, member: Address) {
        member.require_auth();

        let ch_key = Self::channel_key(&channel_id);
        let maybe_channel: Option<Channel> = env.storage().instance().get(&ch_key);
        if maybe_channel.is_none() {
            panic_with_error!(&env, MemoChatError::ChannelNotFound);
        }
        let mut channel = maybe_channel.unwrap();

        let mem_key = Self::channel_members_key(&channel_id);
        let mut members: Vec<Address> = env.storage().instance().get(&mem_key).unwrap_or(Vec::new(&env));

        let mut already = false;
        for m in members.iter() {
            if m == member {
                already = true;
            }
        }
        if already {
            panic_with_error!(&env, MemoChatError::AlreadyMember);
        }

        members.push_back(member);
        env.storage().instance().set(&mem_key, &members);

        channel.member_count += 1;
        env.storage().instance().set(&ch_key, &channel);
    }

    pub fn send_memo(
        env: Env,
        id: Symbol,
        sender: Address,
        channel: Symbol,
        content: String,
        timestamp: u64,
    ) {
        sender.require_auth();

        if content.len() == 0 {
            panic_with_error!(&env, MemoChatError::ContentEmpty);
        }
        if timestamp == 0 {
            panic_with_error!(&env, MemoChatError::InvalidTimestamp);
        }

        let ch_key = Self::channel_key(&channel);
        let maybe_channel: Option<Channel> = env.storage().instance().get(&ch_key);
        if maybe_channel.is_none() {
            panic_with_error!(&env, MemoChatError::ChannelNotFound);
        }
        let mut ch = maybe_channel.unwrap();

        let memo = Memo {
            sender,
            channel: channel.clone(),
            content,
            timestamp,
        };

        env.storage().instance().set(&Self::memo_key(&id), &memo);

        let mut memos = Self::load_ids(&env, &Self::memo_list_key());
        if !Self::has_id(&memos, &id) {
            memos.push_back(id);
            env.storage().instance().set(&Self::memo_list_key(), &memos);
        }

        ch.message_count += 1;
        env.storage().instance().set(&ch_key, &ch);
    }

    pub fn get_memo(env: Env, id: Symbol) -> Option<Memo> {
        env.storage().instance().get(&Self::memo_key(&id))
    }

    pub fn get_channel(env: Env, id: Symbol) -> Option<Channel> {
        env.storage().instance().get(&Self::channel_key(&id))
    }

    pub fn list_channels(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env, &Self::channel_list_key())
    }

    pub fn get_channel_message_count(env: Env, channel_id: Symbol) -> u32 {
        let maybe_channel: Option<Channel> = env.storage().instance().get(&Self::channel_key(&channel_id));
        if let Some(ch) = maybe_channel {
            ch.message_count
        } else {
            0
        }
    }
}
