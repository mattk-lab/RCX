require('dotenv').config();

const express = require('express');
const authRouter = require('./auth/router');
const authenticate = require('./middleware/authenticate');

const app = express();
app.use(express.json());

app.use('/auth', authRouter);

// Example protected route
app.get('/me', authenticate, (req, res) => {
  res.json({ id: req.user.sub, email: req.user.email });
});

module.exports = app;
