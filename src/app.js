const express = require('express');
const authRouter = require('./routes/auth');
const authenticate = require('./middleware/authenticate');

const app = express();
app.use(express.json());

app.use('/auth', authRouter);

// Example protected route
app.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

module.exports = app;
