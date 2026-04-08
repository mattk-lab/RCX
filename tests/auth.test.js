const request = require('supertest');
const app = require('../src/app');
const { _clearUsers } = require('../src/services/userService');

beforeEach(() => _clearUsers());

describe('POST /auth/register', () => {
  it('registers a new user and returns a token', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'alice@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate email with 409', async () => {
    await request(app).post('/auth/register').send({ email: 'alice@example.com', password: 'password123' });
    const res = await request(app).post('/auth/register').send({ email: 'alice@example.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('rejects missing fields with 400', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'alice@example.com' });
    expect(res.status).toBe(400);
  });

  it('rejects short password with 400', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'alice@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register').send({ email: 'alice@example.com', password: 'password123' });
  });

  it('logs in with correct credentials and returns a token', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'alice@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects wrong password with 401', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'alice@example.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('rejects unknown email with 401', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
  });
});

describe('GET /me', () => {
  it('returns user info for a valid token', async () => {
    const reg = await request(app).post('/auth/register').send({ email: 'alice@example.com', password: 'password123' });
    const { token } = reg.body;
    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('alice@example.com');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await request(app).get('/me').set('Authorization', 'Bearer bad.token.here');
    expect(res.status).toBe(401);
  });
});
