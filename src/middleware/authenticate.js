const jwt = require('jsonwebtoken');
const { verify } = require('../auth/tokens');

function classifyJwtError(err) {
  if (err instanceof jwt.TokenExpiredError) return 'expired_token';
  return 'invalid_token';
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
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

authenticate.classifyJwtError = classifyJwtError;
module.exports = authenticate;
