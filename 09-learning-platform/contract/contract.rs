#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Course {
    pub instructor: Address,
    pub title: String,
    pub description: String,
    pub category: Symbol,
    pub max_students: u32,
    pub enrolled_count: u32,
    pub completed_count: u32,
    pub price: i128,
    pub total_rating: u32,
    pub rating_count: u32,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum EnrollmentStatus {
    Enrolled,
    Completed,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IdList,
    Course(Symbol),
    Enrollment(Symbol, Address),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    InvalidTitle = 1,
    InvalidTimestamp = 2,
    CourseNotFound = 3,
    CourseFull = 4,
    AlreadyEnrolled = 5,
    NotEnrolled = 6,
    AlreadyCompleted = 7,
    InvalidRating = 8,
    NotCompleted = 9,
}

#[contract]
pub struct LearningPlatformContract;

#[contractimpl]
impl LearningPlatformContract {
    fn ids_key() -> DataKey {
        DataKey::IdList
    }

    fn course_key(id: &Symbol) -> DataKey {
        DataKey::Course(id.clone())
    }

    fn enrollment_key(course_id: &Symbol, student: &Address) -> DataKey {
        DataKey::Enrollment(course_id.clone(), student.clone())
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

    pub fn create_course(
        env: Env,
        id: Symbol,
        instructor: Address,
        title: String,
        description: String,
        category: Symbol,
        max_students: u32,
        price: i128,
    ) {
        instructor.require_auth();

        if title.len() == 0 {
            panic_with_error!(&env, ContractError::InvalidTitle);
        }

        let now = env.ledger().timestamp();

        let course = Course {
            instructor,
            title,
            description,
            category,
            max_students,
            enrolled_count: 0,
            completed_count: 0,
            price,
            total_rating: 0,
            rating_count: 0,
            created_at: now,
        };

        let key = Self::course_key(&id);
        env.storage().instance().set(&key, &course);

        let mut ids = Self::load_ids(&env);
        if !Self::has_id(&ids, &id) {
            ids.push_back(id);
            Self::save_ids(&env, &ids);
        }
    }

    pub fn enroll_student(env: Env, course_id: Symbol, student: Address) {
        student.require_auth();

        let key = Self::course_key(&course_id);
        let mut course: Course = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::CourseNotFound));

        let enroll_key = Self::enrollment_key(&course_id, &student);
        if env.storage().instance().has(&enroll_key) {
            panic_with_error!(&env, ContractError::AlreadyEnrolled);
        }

        if course.enrolled_count >= course.max_students {
            panic_with_error!(&env, ContractError::CourseFull);
        }

        course.enrolled_count = course.enrolled_count + 1;
        env.storage().instance().set(&key, &course);
        env.storage().instance().set(&enroll_key, &EnrollmentStatus::Enrolled);
    }

    pub fn complete_course(env: Env, course_id: Symbol, student: Address) {
        student.require_auth();

        let key = Self::course_key(&course_id);
        let mut course: Course = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::CourseNotFound));

        let enroll_key = Self::enrollment_key(&course_id, &student);
        let status: Option<EnrollmentStatus> = env.storage().instance().get(&enroll_key);

        match status {
            None => panic_with_error!(&env, ContractError::NotEnrolled),
            Some(EnrollmentStatus::Completed) => panic_with_error!(&env, ContractError::AlreadyCompleted),
            Some(EnrollmentStatus::Enrolled) => {}
        }

        course.completed_count = course.completed_count + 1;
        env.storage().instance().set(&key, &course);
        env.storage().instance().set(&enroll_key, &EnrollmentStatus::Completed);
    }

    pub fn rate_course(env: Env, course_id: Symbol, student: Address, rating: u32) {
        student.require_auth();

        if rating < 1 || rating > 5 {
            panic_with_error!(&env, ContractError::InvalidRating);
        }

        let key = Self::course_key(&course_id);
        let mut course: Course = env.storage().instance().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::CourseNotFound));

        let enroll_key = Self::enrollment_key(&course_id, &student);
        let status: Option<EnrollmentStatus> = env.storage().instance().get(&enroll_key);

        match status {
            None => panic_with_error!(&env, ContractError::NotEnrolled),
            Some(EnrollmentStatus::Enrolled) => panic_with_error!(&env, ContractError::NotCompleted),
            Some(EnrollmentStatus::Completed) => {}
        }

        course.total_rating = course.total_rating + rating;
        course.rating_count = course.rating_count + 1;
        env.storage().instance().set(&key, &course);
    }

    pub fn get_course(env: Env, id: Symbol) -> Option<Course> {
        env.storage().instance().get(&Self::course_key(&id))
    }

    pub fn list_courses(env: Env) -> Vec<Symbol> {
        Self::load_ids(&env)
    }

    pub fn get_enrollment_count(env: Env, course_id: Symbol) -> u32 {
        let key = Self::course_key(&course_id);
        if let Some(course) = env.storage().instance().get::<DataKey, Course>(&key) {
            course.enrolled_count
        } else {
            0
        }
    }
}
