const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';

if (!SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

function sign(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

function verify(token) {
  return jwt.verify(token, SECRET, { algorithms: ['HS256'] });
}

module.exports = { sign, verify };
