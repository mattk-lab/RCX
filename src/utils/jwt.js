const jwt = require('jsonwebtoken');

const secret = () => process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production';
const EXPIRY = '1h';

function sign(payload) {
  return jwt.sign(payload, secret(), { expiresIn: EXPIRY });
}

function verify(token) {
  return jwt.verify(token, secret());
}

module.exports = { sign, verify };
