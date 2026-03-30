import request from 'supertest';
import { APP_URL, ADMIN_EMAIL, ADMIN_PASSWORD } from '../utils/constants';
import { RoleEnum } from '../../src/roles/roles.enum';
import { StatusEnum } from '../../src/statuses/statuses.enum';

describe('Analytics Serialization (no password leakage)', () => {
  const suffix = Date.now();
  const ownerEmail = `owner.analytics.${suffix}@example.com`;
  const driverEmail = `driver.analytics.${suffix}@example.com`;
  const password = 'secret';

  const receiptImageUrl = `https://example.com/bill-${suffix}.jpg`;

  let adminToken: string;
  let ownerToken: string;
  let driverToken: string;

  let harvestAreaId: string;
  let weighingStationId: string;
  let receiptId: string;

  beforeAll(async () => {
    const adminLogin = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    adminToken = adminLogin.body.token;

    const ownerLogin = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: ownerEmail, password })
      .catch(() => null);

    if (!ownerLogin) {
      await request(APP_URL)
        .post('/api/v1/users')
        .auth(adminToken, { type: 'bearer' })
        .send({
          email: ownerEmail,
          password,
          firstName: `Owner${suffix}`,
          lastName: 'E2E',
          role: { id: RoleEnum.owner },
          status: { id: StatusEnum.active },
        })
        .expect(201);

      const ownerAuth = await request(APP_URL)
        .post('/api/v1/auth/email/login')
        .send({ email: ownerEmail, password })
        .expect(200);

      ownerToken = ownerAuth.body.token;
    } else {
      ownerToken = ownerLogin.body.token;
    }

    const weighingStationResp = await request(APP_URL)
      .post('/api/v1/weighing-stations')
      .auth(ownerToken, { type: 'bearer' })
      .send({
        name: `Station-${suffix}`,
        code: `TRM-${suffix}`,
        latitude: 10.762622,
        longitude: 106.660172,
        formattedAddress: '123 Main St',
        unitPrice: 1200,
      })
      .expect(201);

    weighingStationId = weighingStationResp.body.id;

    const harvestAreaResp = await request(APP_URL)
      .post('/api/v1/harvest-areas')
      .auth(ownerToken, { type: 'bearer' })
      .send({
        name: `Harvest-${suffix}`,
      })
      .expect(201);

    harvestAreaId = harvestAreaResp.body.id;

    const driverResp = await request(APP_URL)
      .post('/api/v1/owner/drivers')
      .auth(ownerToken, { type: 'bearer' })
      .send({
        email: driverEmail,
        password,
        firstName: `Driver${suffix}`,
        lastName: 'E2E',
      })
      .expect(201);

    await request(APP_URL)
      .put(`/api/v1/owner/drivers/${driverResp.body.id}/harvest-areas`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ harvestAreaIds: [harvestAreaId] })
      .expect(204);

    const driverLogin = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: driverEmail, password })
      .expect(200);

    driverToken = driverLogin.body.token;

    await request(APP_URL)
      .post('/api/v1/trips')
      .auth(driverToken, { type: 'bearer' })
      .send({
        harvestAreaId,
        weighingStationId,
        startNow: true,
      })
      .expect(201);

    // Submit receipt
    const submitReceiptResp = await request(APP_URL)
      .post('/api/v1/receipts')
      .auth(driverToken, { type: 'bearer' })
      .send({
        harvestAreaId,
        weighingStationId,
        weight: 1.25,
        amount: 15000,
        receiptDate: new Date().toISOString(),
        imageUrls: [receiptImageUrl],
      })
      .expect(201);

    receiptId = submitReceiptResp.body.id;

    // Approve receipt (creates finance_record)
    await request(APP_URL)
      .post(`/api/v1/receipts/${receiptId}/approve`)
      .auth(ownerToken, { type: 'bearer' })
      .send({})
      .expect(200);
  });

  it('should not leak password in analytics driver detail', async () => {
    const resp = await request(APP_URL)
      .get('/api/v1/analytics/drivers/me/detail')
      .auth(driverToken, { type: 'bearer' })
      .expect(200);

    expect(resp.body.driver).toBeDefined();
    expect(resp.body.driver.password).toBeUndefined();
    expect(JSON.stringify(resp.body)).not.toContain('password');
  });
});
