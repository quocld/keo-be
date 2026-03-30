import request from 'supertest';
import { APP_URL, ADMIN_EMAIL, ADMIN_PASSWORD } from '../utils/constants';
import { RoleEnum } from '../../src/roles/roles.enum';
import { StatusEnum } from '../../src/statuses/statuses.enum';

describe('Analytics Scope & Metrics (no realtime)', () => {
  const suffix = Date.now();
  const password = 'secret';

  const owner1Email = `owner1.analytics.${suffix}@example.com`;
  const owner2Email = `owner2.analytics.${suffix}@example.com`;
  const driver1Email = `driver1.analytics.${suffix}@example.com`;
  const driver2Email = `driver2.analytics.${suffix}@example.com`;

  const receiptImageUrl = `https://example.com/bill-${suffix}.jpg`;

  let adminToken: string;
  let owner1Token: string;
  let owner2Token: string;
  let driver1Token: string;
  let driver2Token: string;

  let harvestAreaId1: string;
  let harvestAreaId2: string;
  let weighingStationId1: string;
  let weighingStationId2: string;

  beforeAll(async () => {
    const adminLogin = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    adminToken = adminLogin.body.token;

    // Owners
    await request(APP_URL)
      .post('/api/v1/users')
      .auth(adminToken, { type: 'bearer' })
      .send({
        email: owner1Email,
        password,
        firstName: `Owner1-${suffix}`,
        lastName: 'E2E',
        role: { id: RoleEnum.owner },
        status: { id: StatusEnum.active },
      })
      .expect(201);

    await request(APP_URL)
      .post('/api/v1/users')
      .auth(adminToken, { type: 'bearer' })
      .send({
        email: owner2Email,
        password,
        firstName: `Owner2-${suffix}`,
        lastName: 'E2E',
        role: { id: RoleEnum.owner },
        status: { id: StatusEnum.active },
      })
      .expect(201);

    owner1Token = (
      await request(APP_URL)
        .post('/api/v1/auth/email/login')
        .send({ email: owner1Email, password })
        .expect(200)
    ).body.token;

    owner2Token = (
      await request(APP_URL)
        .post('/api/v1/auth/email/login')
        .send({ email: owner2Email, password })
        .expect(200)
    ).body.token;

    // Weighing stations (must be usable by drivers of that owner)
    const station1 = await request(APP_URL)
      .post('/api/v1/weighing-stations')
      .auth(owner1Token, { type: 'bearer' })
      .send({
        name: `Station1-${suffix}`,
        code: `TRM1-${suffix}`,
        latitude: 10.762622,
        longitude: 106.660172,
        formattedAddress: 'Addr1',
        unitPrice: 1000,
        status: 'active',
      })
      .expect(201);
    weighingStationId1 = station1.body.id;

    const station2 = await request(APP_URL)
      .post('/api/v1/weighing-stations')
      .auth(owner2Token, { type: 'bearer' })
      .send({
        name: `Station2-${suffix}`,
        code: `TRM2-${suffix}`,
        latitude: 10.772622,
        longitude: 106.670172,
        formattedAddress: 'Addr2',
        unitPrice: 2000,
        status: 'active',
      })
      .expect(201);
    weighingStationId2 = station2.body.id;

    // Harvest areas
    const ha1 = await request(APP_URL)
      .post('/api/v1/harvest-areas')
      .auth(owner1Token, { type: 'bearer' })
      .send({ name: `Harvest1-${suffix}` })
      .expect(201);
    harvestAreaId1 = ha1.body.id;

    const ha2 = await request(APP_URL)
      .post('/api/v1/harvest-areas')
      .auth(owner2Token, { type: 'bearer' })
      .send({ name: `Harvest2-${suffix}` })
      .expect(201);
    harvestAreaId2 = ha2.body.id;

    // Managed drivers
    const driver1 = await request(APP_URL)
      .post('/api/v1/owner/drivers')
      .auth(owner1Token, { type: 'bearer' })
      .send({
        email: driver1Email,
        password,
        firstName: `Driver1-${suffix}`,
        lastName: 'E2E',
      })
      .expect(201);
    const driver1UserId = driver1.body.id;

    const driver2 = await request(APP_URL)
      .post('/api/v1/owner/drivers')
      .auth(owner2Token, { type: 'bearer' })
      .send({
        email: driver2Email,
        password,
        firstName: `Driver2-${suffix}`,
        lastName: 'E2E',
      })
      .expect(201);
    const driver2UserId = driver2.body.id;

    // Assign harvest areas
    await request(APP_URL)
      .put(`/api/v1/owner/drivers/${driver1UserId}/harvest-areas`)
      .auth(owner1Token, { type: 'bearer' })
      .send({ harvestAreaIds: [harvestAreaId1] })
      .expect(204);

    await request(APP_URL)
      .put(`/api/v1/owner/drivers/${driver2UserId}/harvest-areas`)
      .auth(owner2Token, { type: 'bearer' })
      .send({ harvestAreaIds: [harvestAreaId2] })
      .expect(204);

    // Login drivers
    driver1Token = (
      await request(APP_URL)
        .post('/api/v1/auth/email/login')
        .send({ email: driver1Email, password })
        .expect(200)
    ).body.token;

    driver2Token = (
      await request(APP_URL)
        .post('/api/v1/auth/email/login')
        .send({ email: driver2Email, password })
        .expect(200)
    ).body.token;

    // Start trips (in_progress)
    await request(APP_URL)
      .post('/api/v1/trips')
      .auth(driver1Token, { type: 'bearer' })
      .send({
        harvestAreaId: harvestAreaId1,
        weighingStationId: weighingStationId1,
        startNow: true,
      })
      .expect(201);

    await request(APP_URL)
      .post('/api/v1/trips')
      .auth(driver2Token, { type: 'bearer' })
      .send({
        harvestAreaId: harvestAreaId2,
        weighingStationId: weighingStationId2,
        startNow: true,
      })
      .expect(201);

    // Receipts: pending + approved for each driver
    // Owner1 (unitPrice=1000, approvedWeight=2 => profit=2000)
    await request(APP_URL)
      .post('/api/v1/receipts')
      .auth(driver1Token, { type: 'bearer' })
      .send({
        harvestAreaId: harvestAreaId1,
        weighingStationId: weighingStationId1,
        weight: 1,
        amount: 100,
        receiptDate: new Date().toISOString(),
        imageUrls: [receiptImageUrl],
      })
      .expect(201);

    const approved1 = await request(APP_URL)
      .post('/api/v1/receipts')
      .auth(driver1Token, { type: 'bearer' })
      .send({
        harvestAreaId: harvestAreaId1,
        weighingStationId: weighingStationId1,
        weight: 2,
        amount: 300,
        receiptDate: new Date().toISOString(),
        imageUrls: [receiptImageUrl],
      })
      .expect(201);

    await request(APP_URL)
      .post(`/api/v1/receipts/${approved1.body.id}/approve`)
      .auth(owner1Token, { type: 'bearer' })
      .send({})
      .expect(200);

    // Owner2 (unitPrice=2000, approvedWeight=2 => profit=4000)
    await request(APP_URL)
      .post('/api/v1/receipts')
      .auth(driver2Token, { type: 'bearer' })
      .send({
        harvestAreaId: harvestAreaId2,
        weighingStationId: weighingStationId2,
        weight: 1,
        amount: 120,
        receiptDate: new Date().toISOString(),
        imageUrls: [receiptImageUrl],
      })
      .expect(201);

    const approved2 = await request(APP_URL)
      .post('/api/v1/receipts')
      .auth(driver2Token, { type: 'bearer' })
      .send({
        harvestAreaId: harvestAreaId2,
        weighingStationId: weighingStationId2,
        weight: 2,
        amount: 420,
        receiptDate: new Date().toISOString(),
        imageUrls: [receiptImageUrl],
      })
      .expect(201);

    await request(APP_URL)
      .post(`/api/v1/receipts/${approved2.body.id}/approve`)
      .auth(owner2Token, { type: 'bearer' })
      .send({})
      .expect(200);
  });

  it('should let owner1 dashboard include only owner1 data', async () => {
    const dash = await request(APP_URL)
      .get('/api/v1/analytics/dashboard/summary')
      .auth(owner1Token, { type: 'bearer' })
      .expect(200);

    expect(dash.body.profit).toBe(2000);
    expect(dash.body.revenue).toBe(2000);
    expect(dash.body.pendingReceiptsCount).toBe(1);
  });

  it('should let owner2 dashboard include only owner2 data', async () => {
    const dash = await request(APP_URL)
      .get('/api/v1/analytics/dashboard/summary')
      .auth(owner2Token, { type: 'bearer' })
      .expect(200);

    expect(dash.body.profit).toBe(4000);
    expect(dash.body.revenue).toBe(4000);
    expect(dash.body.pendingReceiptsCount).toBe(1);
  });

  it('should scope driver1 receipts/finance reports to driver1 only', async () => {
    const receiptsReport = await request(APP_URL)
      .get('/api/v1/analytics/reports/receipts')
      .auth(driver1Token, { type: 'bearer' })
      .expect(200);

    const totalReceipts = (receiptsReport.body.data ?? []).reduce(
      (acc: number, r: { count: number }) => acc + Number(r.count ?? 0),
      0,
    );
    expect(totalReceipts).toBe(2); // 1 pending + 1 approved

    const financeReport = await request(APP_URL)
      .get('/api/v1/analytics/reports/finance')
      .auth(driver1Token, { type: 'bearer' })
      .expect(200);

    const totalProfit = (financeReport.body.data ?? []).reduce(
      (acc: number, r: { profitSum: number }) => acc + Number(r.profitSum ?? 0),
      0,
    );
    expect(totalProfit).toBe(2000);
  });

  it('should reflect driver1 detail pending/approved + finance correctly', async () => {
    const detail = await request(APP_URL)
      .get('/api/v1/analytics/drivers/me/detail')
      .auth(driver1Token, { type: 'bearer' })
      .expect(200);

    expect(detail.body.receiptsSummary.pendingCount).toBe(1);
    expect(detail.body.receiptsSummary.approvedCount).toBe(1);
    expect(detail.body.financeSummary.profitSum).toBe(2000);
  });
});
