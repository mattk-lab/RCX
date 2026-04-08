process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const userStore = require('../src/auth/userStore');

const SECRET = process.env.JWT_SECRET;

function makeToken(payload, opts = {}) {
  return jwt.sign(payload, SECRET, { algorithm: 'HS256', ...opts });
}

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

  it('rejects missing token with missing_token error', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('missing_token');
  });

  it('rejects malformed token with invalid_token error', async () => {
    const res = await request(app)
      .get('/me')
      .set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_token');
  });

  it('rejects expired token with expired_token error', async () => {
    const expiredToken = makeToken(
      { sub: 'user-id', email: 'eve@example.com', roles: ['user'] },
      { expiresIn: -1 }
    );
    const res = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('expired_token');
  });

  it('rejects token signed with wrong algorithm (RS256 confusion) with invalid_token', async () => {
    const wrongToken = jwt.sign(
      { sub: 'user-id', email: 'eve@example.com', roles: ['user'] },
      'wrong-secret',
      { algorithm: 'HS256' }
    );
    const res = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${wrongToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_token');
  });

  it('rejects token with bad signature with invalid_token', async () => {
    const parts = token.split('.');
    const badToken = `${parts[0]}.${parts[1]}.invalidsignature`;
    const res = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_token');
  });

  it('drops unknown fields from req.user (only sub, email, roles exposed)', async () => {
    const tokenWithExtra = makeToken({
      sub: 'user-id',
      email: 'eve@example.com',
      roles: ['user'],
      internalField: 'secret',
    });
    const res = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${tokenWithExtra}`);
    expect(res.status).toBe(200);
    expect(res.body.internalField).toBeUndefined();
  });
});

describe('GET /admin — requireRole', () => {
  let userToken;
  let adminToken;

  beforeEach(() => {
    userToken = makeToken({ sub: 'u1', email: 'user@example.com', roles: ['user'] });
    adminToken = makeToken({ sub: 'u2', email: 'admin@example.com', roles: ['admin'] });
  });

  it('allows request when token has matching role', async () => {
    const res = await request(app)
      .get('/admin')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 403 when token lacks required role', async () => {
    const res = await request(app)
      .get('/admin')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(401);
  });
});

describe('GET /public — optionalAuth', () => {
  it('sets req.user to null when no token is provided', async () => {
    const res = await request(app).get('/public');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it('populates req.user when a valid token is provided', async () => {
    const token = makeToken({ sub: 'u1', email: 'alice@example.com', roles: ['user'] });
    const res = await request(app)
      .get('/public')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'alice@example.com' });
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/public')
      .set('Authorization', 'Bearer bad.token.here');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_token');
  });
});

describe('POST /auth/login — rate limiting', () => {
  beforeEach(async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'rl@example.com', password: 'password123' });
  });

  it('allows up to 5 requests and blocks the 6th with 429 + Retry-After', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', '10.0.0.1')
        .send({ email: 'rl@example.com', password: 'password123' });
    }

    const res = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', '10.0.0.1')
      .send({ email: 'rl@example.com', password: 'password123' });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('too_many_requests');
    expect(res.headers['retry-after']).toBeDefined();
  });
});
