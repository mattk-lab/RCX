const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

// In-memory user store keyed by email
const users = new Map();

async function createUser(email, password) {
  if (users.has(email)) {
    throw Object.assign(new Error('Email already registered'), { code: 'DUPLICATE_EMAIL' });
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = { id: users.size + 1, email, passwordHash };
  users.set(email, user);
  return { id: user.id, email: user.email };
}

async function verifyCredentials(email, password) {
  const user = users.get(email);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return null;
  return { id: user.id, email: user.email };
}

// Exported for test setup/teardown
function _clearUsers() {
  users.clear();
}

module.exports = { createUser, verifyCredentials, _clearUsers };
