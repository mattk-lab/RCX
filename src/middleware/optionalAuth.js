const jwt = require('jsonwebtoken');
const { verify } = require('../auth/tokens');
const authenticate = require('./authenticate');

const { classifyJwtError } = authenticate;

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.slice(7);
  try {
    const decoded = verify(token);
    const { sub, email, roles } = decoded;
    req.user = { sub, email, roles: Array.isArray(roles) ? roles : [] };
    next();
  } catch (err) {
    return res.status(401).json({ error: classifyJwtError(err) });
  }
}

module.exports = optionalAuth;
