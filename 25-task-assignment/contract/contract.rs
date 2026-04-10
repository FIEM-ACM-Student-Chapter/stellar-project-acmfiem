#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Task {
    pub creator: Address,
    pub assignee: Address,
    pub reviewer: Address,
    pub title: String,
    pub description: String,
    pub priority: u32,
    pub status: Symbol,
    pub estimated_hours: u32,
    pub actual_hours: u32,
    pub due_date: u64,
    pub created_at: u64,
    pub completed_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum TaskDataKey {
    IdList,
    Item(Symbol),
    Count,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TaskError {
    InvalidTitle = 1,
    InvalidTimestamp = 2,
    NotFound = 3,
    NotCreator = 4,
    NotAssignee = 5,
    InvalidStatus = 6,
    InvalidPriority = 7,
    AlreadyCompleted = 8,
}

#[contract]
pub struct TaskAssignmentContract;

#[contractimpl]
impl TaskAssignmentContract {
    fn ids_key() -> TaskDataKey {
        TaskDataKey::IdList
    }

    fn item_key(id: &Symbol) -> TaskDataKey {
        TaskDataKey::Item(id.clone())
    }

    fn count_key() -> TaskDataKey {
        TaskDataKey::Count
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

    fn increment_count(env: &Env) {
        let count: u32 = env.storage().instance().get(&Self::count_key()).unwrap_or(0);
        env.storage().instance().set(&Self::count_key(), &(count + 1));
    }

    pub fn create_task(
        env: Env,
        id: Symbol,
        creator: Address,
        title: String,
        description: String,
        priority: u32,
        due_date: u64,
        estimated_hours: u32,
    ) {
        creator.require_auth();

        if title.len() == 0 {
            panic_with_error!(env, TaskError::InvalidTitle);
        }
        if priority > 5 {
            panic_with_error!(env, TaskError::InvalidPriority);
        }

        let todo_sym = Symbol::new(&env, "todo");

        let task = Task {
            creator: creator.clone(),
            assignee: creator.clone(),
            reviewer: creator,
            title,
            description,
            priority,
            status: todo_sym,
            estimated_hours,
            actual_hours: 0,
            due_date,
            created_at: env.ledger().timestamp(),
            completed_at: 0,
        };

        let key = Self::item_key(&id);
        let exists = env.storage().instance().has(&key);
        env.storage().instance().set(&key, &task);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
            if !exists {
                Self::increment_count(&env);
            }
        }
    }

    pub fn assign_task(env: Env, id: Symbol, creator: Address, assignee: Address) {
        creator.require_auth();

        let key = Self::item_key(&id);
        let maybe_task: Option<Task> = env.storage().instance().get(&key);

        if let Some(mut task) = maybe_task {
            if task.creator != creator {
                panic_with_error!(env, TaskError::NotCreator);
            }

            let assigned_sym = Symbol::new(&env, "assigned");
            task.assignee = assignee;
            task.status = assigned_sym;
            env.storage().instance().set(&key, &task);
        } else {
            panic_with_error!(env, TaskError::NotFound);
        }
    }

    pub fn start_task(env: Env, id: Symbol, assignee: Address) {
        assignee.require_auth();

        let key = Self::item_key(&id);
        let maybe_task: Option<Task> = env.storage().instance().get(&key);

        if let Some(mut task) = maybe_task {
            if task.assignee != assignee {
                panic_with_error!(env, TaskError::NotAssignee);
            }

            let assigned_sym = Symbol::new(&env, "assigned");
            if task.status != assigned_sym {
                panic_with_error!(env, TaskError::InvalidStatus);
            }

            let in_progress_sym = Symbol::new(&env, "in_progress");
            task.status = in_progress_sym;
            env.storage().instance().set(&key, &task);
        } else {
            panic_with_error!(env, TaskError::NotFound);
        }
    }

    pub fn complete_task(env: Env, id: Symbol, assignee: Address, actual_hours: u32) {
        assignee.require_auth();

        let key = Self::item_key(&id);
        let maybe_task: Option<Task> = env.storage().instance().get(&key);

        if let Some(mut task) = maybe_task {
            if task.assignee != assignee {
                panic_with_error!(env, TaskError::NotAssignee);
            }

            let in_progress_sym = Symbol::new(&env, "in_progress");
            if task.status != in_progress_sym {
                panic_with_error!(env, TaskError::InvalidStatus);
            }

            let completed_sym = Symbol::new(&env, "completed");
            task.status = completed_sym;
            task.actual_hours = actual_hours;
            task.completed_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &task);
        } else {
            panic_with_error!(env, TaskError::NotFound);
        }
    }

    pub fn review_task(env: Env, id: Symbol, reviewer: Address, approved: bool) {
        reviewer.require_auth();

        let key = Self::item_key(&id);
        let maybe_task: Option<Task> = env.storage().instance().get(&key);

        if let Some(mut task) = maybe_task {
            let completed_sym = Symbol::new(&env, "completed");
            if task.status != completed_sym {
                panic_with_error!(env, TaskError::InvalidStatus);
            }

            task.reviewer = reviewer;
            if approved {
                let approved_sym = Symbol::new(&env, "approved");
                task.status = approved_sym;
            } else {
                let rejected_sym = Symbol::new(&env, "rejected");
                task.status = rejected_sym;
            }
            env.storage().instance().set(&key, &task);
        } else {
            panic_with_error!(env, TaskError::NotFound);
        }
    }

    pub fn get_task(env: Env, id: Symbol) -> Option<Task> {
        env.storage().instance().get(&Self::item_key(&id))
    }

    pub fn list_tasks(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_task_count(env: Env) -> u32 {
        env.storage().instance().get(&Self::count_key()).unwrap_or(0)
    }
}
