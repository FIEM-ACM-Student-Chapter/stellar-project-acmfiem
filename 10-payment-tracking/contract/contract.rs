#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Invoice {
    pub issuer: Address,
    pub recipient: Address,
    pub description: String,
    pub amount: i128,
    pub paid_amount: i128,
    pub status: Symbol,
    pub due_date: u64,
    pub created_at: u64,
    pub paid_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IdList,
    Invoice(Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    InvalidDescription = 1,
    InvalidTimestamp = 2,
    InvoiceNotFound = 3,
    NotIssuer = 4,
    AlreadyPaid = 5,
    AlreadyCancelled = 6,
    InvalidAmount = 7,
}

#[contract]
pub struct PaymentTrackingContract;

#[contractimpl]
impl PaymentTrackingContract {
    fn ids_key() -> DataKey {
        DataKey::IdList
    }

    fn invoice_key(id: &Symbol) -> DataKey {
        DataKey::Invoice(id.clone())
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

    pub fn create_invoice(
        env: Env,
        id: Symbol,
        issuer: Address,
        recipient: Address,
        description: String,
        amount: i128,
        due_date: u64,
    ) {
        issuer.require_auth();

        if description.len() == 0 {
            panic_with_error!(&env, ContractError::InvalidDescription);
        }

        if amount <= 0 {
            panic_with_error!(&env, ContractError::InvalidAmount);
        }

        let now = env.ledger().timestamp();
        let pending = Symbol::new(&env, "pending");

        let invoice = Invoice {
            issuer,
            recipient,
            description,
            amount,
            paid_amount: 0,
            status: pending,
            due_date,
            created_at: now,
            paid_at: 0,
        };

        let key = Self::invoice_key(&id);
        env.storage().instance().set(&key, &invoice);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn mark_paid(env: Env, id: Symbol, payer: Address, paid_amount: i128, paid_at: u64) {
        payer.require_auth();

        let key = Self::invoice_key(&id);
        let mut invoice: Invoice = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::InvoiceNotFound));

        let paid = Symbol::new(&env, "paid");
        let cancelled = Symbol::new(&env, "cancelled");

        if invoice.status == paid {
            panic_with_error!(&env, ContractError::AlreadyPaid);
        }

        if invoice.status == cancelled {
            panic_with_error!(&env, ContractError::AlreadyCancelled);
        }

        invoice.paid_amount = paid_amount;
        invoice.status = paid;
        invoice.paid_at = paid_at;
        env.storage().instance().set(&key, &invoice);
    }

    pub fn mark_overdue(env: Env, id: Symbol, issuer: Address) {
        issuer.require_auth();

        let key = Self::invoice_key(&id);
        let mut invoice: Invoice = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::InvoiceNotFound));

        if invoice.issuer != issuer {
            panic_with_error!(&env, ContractError::NotIssuer);
        }

        let overdue = Symbol::new(&env, "overdue");
        invoice.status = overdue;
        env.storage().instance().set(&key, &invoice);
    }

    pub fn cancel_invoice(env: Env, id: Symbol, issuer: Address) {
        issuer.require_auth();

        let key = Self::invoice_key(&id);
        let mut invoice: Invoice = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::InvoiceNotFound));

        if invoice.issuer != issuer {
            panic_with_error!(&env, ContractError::NotIssuer);
        }

        let paid = Symbol::new(&env, "paid");
        if invoice.status == paid {
            panic_with_error!(&env, ContractError::AlreadyPaid);
        }

        let cancelled = Symbol::new(&env, "cancelled");
        invoice.status = cancelled;
        env.storage().instance().set(&key, &invoice);
    }

    pub fn get_invoice(env: Env, id: Symbol) -> Option<Invoice> {
        env.storage().instance().get(&Self::invoice_key(&id))
    }

    pub fn list_invoices(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_total_outstanding(env: Env) -> i128 {
        let ids = Self::load_ids(&env);
        let paid = Symbol::new(&env, "paid");
        let cancelled = Symbol::new(&env, "cancelled");
        let mut total: i128 = 0;
        for id in ids.iter() {
            let key = Self::invoice_key(&id);
            if let Some(invoice) = env.storage().instance().get::<DataKey, Invoice>(&key) {
                if invoice.status != paid && invoice.status != cancelled {
                    total = total + (invoice.amount - invoice.paid_amount);
                }
            }
        }
        total
    }
}
