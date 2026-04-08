const express = require('express');
const { createUser, verifyCredentials } = require('../services/userService');
const { sign } = require('../utils/jwt');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }
  try {
    const user = await createUser(email, password);
    const token = sign({ sub: user.id, email: user.email });
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === 'DUPLICATE_EMAIL') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    throw err;
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const user = await verifyCredentials(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = sign({ sub: user.id, email: user.email });
  res.json({ token, user });
});

module.exports = router;
