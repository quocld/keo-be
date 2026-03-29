import { ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL } from '../utils/constants';
import request from 'supertest';
import { RoleEnum } from '../../src/roles/roles.enum';
import { StatusEnum } from '../../src/statuses/statuses.enum';

describe('Ops Vehicles (admin + owner + driver)', () => {
  const owner1Email = 'john.doe@example.com';
  const defaultPassword = 'secret';
  const suffix = Date.now();

  let adminToken: string;
  let owner1Token: string;
  let owner2Token: string;
  let owner1UserId: number;
  let driverId: number;
  let driverToken: string;
  let adminVehicleId: string;
  let ownerVehicleId: string;

  beforeAll(async () => {
    const adminLogin = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    adminToken = adminLogin.body.token;

    const owner1Login = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: owner1Email, password: defaultPassword });

    owner1Token = owner1Login.body.token;
    owner1UserId = owner1Login.body.user.id;

    const owner2Email = `owner2.vh.${suffix}@example.com`;
    await request(APP_URL)
      .post('/api/v1/users')
      .auth(adminToken, { type: 'bearer' })
      .send({
        email: owner2Email,
        password: defaultPassword,
        firstName: 'O2',
        lastName: 'VH',
        role: { id: RoleEnum.owner },
        status: { id: StatusEnum.active },
      })
      .expect(201);

    const owner2Login = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: owner2Email, password: defaultPassword });

    owner2Token = owner2Login.body.token;

    const driverEmail = `vh.driver.${suffix}@example.com`;
    const createDriverResp = await request(APP_URL)
      .post('/api/v1/owner/drivers')
      .auth(owner1Token, { type: 'bearer' })
      .send({
        email: driverEmail,
        password: defaultPassword,
        firstName: 'VH',
        lastName: 'Driver',
      })
      .expect(201);

    driverId = createDriverResp.body.id;

    const driverLogin = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: driverEmail, password: defaultPassword });

    driverToken = driverLogin.body.token;
  });

  it('should require ownerId when admin creates a vehicle', async () => {
    await request(APP_URL)
      .post('/api/v1/vehicles')
      .auth(adminToken, { type: 'bearer' })
      .send({
        plate: `ADM-NOID-${suffix}`,
        name: 'No owner',
      })
      .expect(422);
  });

  it('should let admin create a vehicle for an owner', async () => {
    const resp = await request(APP_URL)
      .post('/api/v1/vehicles')
      .auth(adminToken, { type: 'bearer' })
      .send({
        plate: `ADM-${suffix}`,
        name: 'Admin fleet',
        ownerId: owner1UserId,
      })
      .expect(201);

    adminVehicleId = resp.body.id;
    expect(resp.body.plate).toBe(`ADM-${suffix}`);
    expect(resp.body.owner?.id).toBe(owner1UserId);
  });

  it('should let owner create a vehicle for self', async () => {
    const resp = await request(APP_URL)
      .post('/api/v1/vehicles')
      .auth(owner1Token, { type: 'bearer' })
      .send({
        plate: `OWN-${suffix}`,
        name: 'Owner fleet',
      })
      .expect(201);

    ownerVehicleId = resp.body.id;
    expect(resp.body.owner?.id).toBe(owner1UserId);
  });

  it('should forbid owner2 from reading owner1 vehicle', async () => {
    const resp = await request(APP_URL)
      .get(`/api/v1/vehicles/${adminVehicleId}`)
      .auth(owner2Token, { type: 'bearer' });

    expect(resp.status).toBe(403);
  });

  it('should let owner assign vehicle to managed driver and sync plate', async () => {
    await request(APP_URL)
      .put(`/api/v1/owner/drivers/${driverId}/vehicle`)
      .auth(owner1Token, { type: 'bearer' })
      .send({ vehicleId: ownerVehicleId })
      .expect(204);

    const getV = await request(APP_URL)
      .get(`/api/v1/owner/drivers/${driverId}/vehicle`)
      .auth(owner1Token, { type: 'bearer' })
      .expect(200);

    expect(getV.body.id).toBe(ownerVehicleId);
    expect(getV.body.plate).toBe(`OWN-${suffix}`);
  });

  it('should let driver list only assigned vehicle', async () => {
    const listResp = await request(APP_URL)
      .get('/api/v1/vehicles')
      .auth(driverToken, { type: 'bearer' })
      .query({ limit: 50 })
      .expect(200);

    expect(listResp.body.data).toHaveLength(1);
    expect(listResp.body.data[0].id).toBe(ownerVehicleId);
  });

  it('should let owner create expense and list', async () => {
    const createExp = await request(APP_URL)
      .post(`/api/v1/vehicles/${ownerVehicleId}/expenses`)
      .auth(owner1Token, { type: 'bearer' })
      .send({
        expenseType: 'fuel',
        amount: 250000,
        occurredAt: '2026-03-01T08:00:00.000Z',
        notes: 'fill up',
      })
      .expect(201);

    expect(Number(createExp.body.amount)).toBe(250000);

    const listExp = await request(APP_URL)
      .get(`/api/v1/vehicles/${ownerVehicleId}/expenses`)
      .auth(owner1Token, { type: 'bearer' })
      .expect(200);

    expect(listExp.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should forbid owner2 from posting expense on owner1 vehicle', async () => {
    await request(APP_URL)
      .post(`/api/v1/vehicles/${ownerVehicleId}/expenses`)
      .auth(owner2Token, { type: 'bearer' })
      .send({
        expenseType: 'repair',
        amount: 100,
        occurredAt: '2026-03-02T08:00:00.000Z',
      })
      .expect(403);
  });

  it('should let owner unassign with null vehicleId', async () => {
    await request(APP_URL)
      .put(`/api/v1/owner/drivers/${driverId}/vehicle`)
      .auth(owner1Token, { type: 'bearer' })
      .send({ vehicleId: null })
      .expect(204);

    await request(APP_URL)
      .get(`/api/v1/owner/drivers/${driverId}/vehicle`)
      .auth(owner1Token, { type: 'bearer' })
      .expect(204);
  });
});
