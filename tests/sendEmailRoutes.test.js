const request = require('supertest');
const app = require('../app');

describe('Email Routes using sendEmail', () => {
  // Contact Form Route
  it('POST /api/send-email should send contact form email', async () => {
    const res = await request(app)
      .post('/api/send-email')
      .send({
        name: 'Test User',
        email: 'testuser@example.com',
        subject: 'Contact Test',
        message: 'This is a contact form test.'
      });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success');
  });

  // Auth Routes (example: registration verification)
  it('POST /api/auth/register should send verification email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'testuser2@example.com',
        password: 'TestPassword123'
      });
    expect([200, 201]).toContain(res.statusCode);
    expect(res.body).toHaveProperty('success');
  });

  // Email Marketing Route
  it('POST /api/email-marketing/send should send marketing email', async () => {
    const res = await request(app)
      .post('/api/email-marketing/send')
      .send({
        subject: 'Marketing Test',
        message: 'This is a marketing test email.',
        targetUsers: 'all'
      });
    expect([200, 201]).toContain(res.statusCode);
    expect(res.body).toHaveProperty('success');
  });
});
