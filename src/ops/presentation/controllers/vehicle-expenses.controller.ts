import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../../roles/roles.decorator';
import { RolesGuard } from '../../../roles/roles.guard';
import { RoleEnum } from '../../../roles/roles.enum';
import { CreateVehicleExpenseDto } from '../../dto/create-vehicle-expense.dto';
import { UpdateVehicleExpenseDto } from '../../dto/update-vehicle-expense.dto';
import { QueryVehicleExpenseDto } from '../../dto/query-vehicle-expense.dto';
import { VehicleExpenseEntity } from '../../infrastructure/persistence/relational/entities/vehicle-expense.entity';
import { VehicleExpensesService } from '../services/vehicle-expenses.service';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../../../utils/dto/infinity-pagination-response.dto';

@ApiBearerAuth()
@ApiTags('VehicleExpenses')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'vehicles/:vehicleId/expenses',
  version: '1',
})
export class VehicleExpensesController {
  constructor(
    private readonly vehicleExpensesService: VehicleExpensesService,
  ) {}

  @ApiCreatedResponse({ type: VehicleExpenseEntity })
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() dto: CreateVehicleExpenseDto,
  ): Promise<VehicleExpenseEntity> {
    return this.vehicleExpensesService.create(request.user, vehicleId, dto);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(VehicleExpenseEntity) })
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @Request() request,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Query() query: QueryVehicleExpenseDto,
  ): Promise<InfinityPaginationResponseDto<VehicleExpenseEntity>> {
    return this.vehicleExpensesService.findMany(request.user, vehicleId, query);
  }

  @ApiOkResponse({ type: VehicleExpenseEntity })
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Get(':expenseId')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Request() request,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
  ): Promise<VehicleExpenseEntity> {
    return this.vehicleExpensesService.findOne(
      request.user,
      vehicleId,
      expenseId,
    );
  }

  @ApiOkResponse({ type: VehicleExpenseEntity })
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Patch(':expenseId')
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Body() dto: UpdateVehicleExpenseDto,
  ): Promise<VehicleExpenseEntity> {
    return this.vehicleExpensesService.update(
      request.user,
      vehicleId,
      expenseId,
      dto,
    );
  }

  @ApiNoContentResponse()
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Delete(':expenseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() request,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
  ): Promise<void> {
    return this.vehicleExpensesService.remove(
      request.user,
      vehicleId,
      expenseId,
    );
  }
}
