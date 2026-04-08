require('dotenv').config();

const express = require('express');
const authRouter = require('./auth/router');
const authenticate = require('./middleware/authenticate');
const requireRole = require('./middleware/requireRole');
const optionalAuth = require('./middleware/optionalAuth');

const app = express();
app.use(express.json());

app.use('/auth', authRouter);

app.get('/me', authenticate, (req, res) => {
  res.json({ id: req.user.sub, email: req.user.email });
});

app.get('/admin', authenticate, requireRole('admin'), (req, res) => {
  res.json({ message: 'admin only' });
});

app.get('/public', optionalAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = app;
