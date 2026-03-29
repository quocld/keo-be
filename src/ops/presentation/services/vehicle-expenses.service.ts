import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { VehicleExpenseEntity } from '../../infrastructure/persistence/relational/entities/vehicle-expense.entity';
import { VehicleEntity } from '../../infrastructure/persistence/relational/entities/vehicle.entity';
import { CreateVehicleExpenseDto } from '../../dto/create-vehicle-expense.dto';
import { UpdateVehicleExpenseDto } from '../../dto/update-vehicle-expense.dto';
import { QueryVehicleExpenseDto } from '../../dto/query-vehicle-expense.dto';
import { OpsAuthorizationService } from './ops-authorization.service';
import { infinityPagination } from '../../../utils/infinity-pagination';
import { InfinityPaginationResponseDto } from '../../../utils/dto/infinity-pagination-response.dto';

@Injectable()
export class VehicleExpensesService {
  constructor(
    @InjectRepository(VehicleExpenseEntity)
    private readonly vehicleExpensesRepository: Repository<VehicleExpenseEntity>,
    @InjectRepository(VehicleEntity)
    private readonly vehiclesRepository: Repository<VehicleEntity>,
    private readonly opsAuthorizationService: OpsAuthorizationService,
  ) {}

  private async requireVehicle(
    actor: JwtPayloadType,
    vehicleId: string,
  ): Promise<VehicleEntity> {
    const vehicle = await this.vehiclesRepository.findOne({
      where: { id: vehicleId },
      relations: ['owner'],
    });

    if (!vehicle) {
      throw new NotFoundException({ error: 'vehicle not found' });
    }

    if (this.opsAuthorizationService.isAdmin(actor)) {
      return vehicle;
    }

    if (
      this.opsAuthorizationService.isOwner(actor) &&
      vehicle.owner?.id === Number(actor.id)
    ) {
      return vehicle;
    }

    throw new ForbiddenException({ error: 'forbidden' });
  }

  async create(
    actor: JwtPayloadType,
    vehicleId: string,
    dto: CreateVehicleExpenseDto,
  ): Promise<VehicleExpenseEntity> {
    await this.requireVehicle(actor, vehicleId);

    const entity = this.vehicleExpensesRepository.create({
      expenseType: dto.expenseType,
      amount: dto.amount.toString(),
      occurredAt: new Date(dto.occurredAt),
      notes: dto.notes ?? null,
      vehicle: { id: vehicleId } as any,
      createdBy: { id: Number(actor.id) } as any,
    });

    return this.vehicleExpensesRepository.save(entity);
  }

  async findMany(
    actor: JwtPayloadType,
    vehicleId: string,
    query: QueryVehicleExpenseDto,
  ): Promise<InfinityPaginationResponseDto<VehicleExpenseEntity>> {
    await this.requireVehicle(actor, vehicleId);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<VehicleExpenseEntity> = {
      vehicle: { id: vehicleId },
    };

    if (query.filters?.expenseType) {
      where.expenseType = query.filters.expenseType;
    }

    const data = await this.vehicleExpensesRepository.find({
      where,
      relations: ['vehicle', 'createdBy'],
      skip,
      take: limit,
      order: { occurredAt: 'DESC' },
    });

    return infinityPagination(data, { page, limit });
  }

  async findOne(
    actor: JwtPayloadType,
    vehicleId: string,
    expenseId: string,
  ): Promise<VehicleExpenseEntity> {
    await this.requireVehicle(actor, vehicleId);

    const entity = await this.vehicleExpensesRepository.findOne({
      where: {
        id: expenseId,
        vehicle: { id: vehicleId },
      },
      relations: ['vehicle', 'createdBy'],
    });

    if (!entity) {
      throw new NotFoundException({ error: 'vehicle expense not found' });
    }

    return entity;
  }

  async update(
    actor: JwtPayloadType,
    vehicleId: string,
    expenseId: string,
    dto: UpdateVehicleExpenseDto,
  ): Promise<VehicleExpenseEntity> {
    await this.requireVehicle(actor, vehicleId);

    const entity = await this.vehicleExpensesRepository.findOne({
      where: {
        id: expenseId,
        vehicle: { id: vehicleId },
      },
    });

    if (!entity) {
      throw new NotFoundException({ error: 'vehicle expense not found' });
    }

    if (dto.expenseType !== undefined) entity.expenseType = dto.expenseType;
    if (dto.amount !== undefined) entity.amount = dto.amount.toString();
    if (dto.occurredAt !== undefined)
      entity.occurredAt = new Date(dto.occurredAt);
    if (dto.notes !== undefined) entity.notes = dto.notes ?? null;

    return this.vehicleExpensesRepository.save(entity);
  }

  async remove(
    actor: JwtPayloadType,
    vehicleId: string,
    expenseId: string,
  ): Promise<void> {
    await this.requireVehicle(actor, vehicleId);

    const res = await this.vehicleExpensesRepository.delete({
      id: expenseId,
      vehicle: { id: vehicleId },
    });

    if (!res.affected) {
      throw new NotFoundException({ error: 'vehicle expense not found' });
    }
  }
}
