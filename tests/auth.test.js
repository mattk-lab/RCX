process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';

const request = require('supertest');
const app = require('../src/app');
const userStore = require('../src/auth/userStore');

beforeEach(() => userStore._clear());

describe('POST /auth/register', () => {
  it('creates a user and returns a JWT', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
  });

  it('rejects a short password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'bob@example.com', password: 'short' });

    expect(res.status).toBe(400);
  });

  it('returns 201 for duplicate email (no enumeration)', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'carol@example.com', password: 'password123' });

    // Second register with same email must not reveal the duplicate
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'carol@example.com', password: 'password456' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
  });

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('rejects password over 72 characters', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'frank@example.com', password: 'a'.repeat(73) });
    expect(res.status).toBe(400);
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/auth/register').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'dave@example.com', password: 'password123' });
  });

  it('returns a JWT for valid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'dave@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'dave@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid credentials');
  });

  it('rejects unknown email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ghost@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });
});

describe('GET /me', () => {
  let token;

  beforeEach(async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'eve@example.com', password: 'password123' });
    token = res.body.token;
  });

  it('returns user info for valid token', async () => {
    const res = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('eve@example.com');
  });

  it('rejects missing token', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
  });

  it('rejects malformed token', async () => {
    const res = await request(app)
      .get('/me')
      .set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
  });
});
