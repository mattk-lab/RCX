const express = require('express');
const bcrypt = require('bcryptjs');
const userStore = require('./userStore');
const { sign } = require('./tokens');

const router = express.Router();
const BCRYPT_ROUNDS = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// bcrypt silently truncates at 72 bytes; cap input to avoid misleading behaviour
const PASSWORD_MAX = 72;

router.post('/register', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'invalid email address' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }
  if (password.length > PASSWORD_MAX) {
    return res.status(400).json({ error: `password must be at most ${PASSWORD_MAX} characters` });
  }

  // Return 201 even when the email already exists to prevent enumeration.
  // We still hash to consume consistent time.
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  if (!userStore.exists(email)) {
    const user = userStore.create({ email, passwordHash });
    const token = sign({ sub: user.id, email: user.email });
    return res.status(201).json({ token });
  }

  // Simulate work for the duplicate path so timing is indistinguishable
  return res.status(201).json({ token: sign({ sub: 'placeholder', email: email.toLowerCase() }) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  if (typeof password !== 'string' || password.length > PASSWORD_MAX) {
    return res.status(400).json({ error: 'invalid credentials' });
  }

  const user = userStore.findByEmail(email);
  if (!user) {
    // Hash anyway to prevent timing oracle
    await bcrypt.hash(password, BCRYPT_ROUNDS);
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const token = sign({ sub: user.id, email: user.email });
  return res.json({ token });
});

module.exports = router;
