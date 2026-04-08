// In-memory user store. Replace with a database in production.
const users = new Map();

function findByEmail(email) {
  return users.get(email.toLowerCase()) ?? null;
}

function create({ email, passwordHash }) {
  const user = { id: crypto.randomUUID(), email: email.toLowerCase(), passwordHash };
  users.set(user.email, user);
  return user;
}

function exists(email) {
  return users.has(email.toLowerCase());
}

// Exposed for test resets only — never call in production
function _clear() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('_clear() is only available in test environments');
  }
  users.clear();
}

module.exports = { findByEmail, create, exists, _clear };
