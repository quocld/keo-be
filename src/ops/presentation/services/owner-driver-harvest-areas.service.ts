import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { DriverHarvestAreaEntity } from '../../infrastructure/persistence/relational/entities/driver-harvest-area.entity';
import { HarvestAreaEntity } from '../../infrastructure/persistence/relational/entities/harvest-area.entity';
import { OpsAuthorizationService } from './ops-authorization.service';

@Injectable()
export class OwnerDriverHarvestAreasService {
  constructor(
    @InjectRepository(DriverHarvestAreaEntity)
    private readonly driverHarvestAreasRepository: Repository<DriverHarvestAreaEntity>,
    @InjectRepository(HarvestAreaEntity)
    private readonly harvestAreasRepository: Repository<HarvestAreaEntity>,
    private readonly opsAuthorizationService: OpsAuthorizationService,
  ) {}

  async list(
    ownerActor: JwtPayloadType,
    driverId: number,
  ): Promise<HarvestAreaEntity[]> {
    await this.opsAuthorizationService.assertOwnerManagesDriver(
      ownerActor,
      driverId,
    );

    const rows = await this.driverHarvestAreasRepository
      .createQueryBuilder('dha')
      .innerJoinAndSelect('dha.harvestArea', 'ha')
      .leftJoinAndSelect('ha.owner', 'owner')
      .where('dha.driver_id = :driverId', { driverId })
      .andWhere('ha.deleted_at IS NULL')
      .orderBy('ha.createdAt', 'DESC')
      .getMany();

    return rows.map((r) => r.harvestArea);
  }

  async replace(
    ownerActor: JwtPayloadType,
    driverId: number,
    harvestAreaIds: string[],
  ): Promise<void> {
    await this.opsAuthorizationService.assertOwnerManagesDriver(
      ownerActor,
      driverId,
    );

    const ownerId = Number(ownerActor.id);

    for (const id of harvestAreaIds) {
      const ha = await this.harvestAreasRepository.findOne({
        where: { id },
        relations: ['owner'],
      });

      if (!ha || ha.owner?.id !== ownerId) {
        throw new UnprocessableEntityException({
          error: 'invalidHarvestAreaId',
        });
      }
    }

    await this.driverHarvestAreasRepository.manager.transaction(async (em) => {
      const repo = em.getRepository(DriverHarvestAreaEntity);
      await repo.delete({ driverId });
      for (const harvestAreaId of harvestAreaIds) {
        await repo.insert({ driverId, harvestAreaId });
      }
    });
  }
}
