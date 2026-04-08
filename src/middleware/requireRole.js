function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.roles)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const hasRole = allowed.some((role) => req.user.roles.includes(role));
    if (!hasRole) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

module.exports = requireRole;
