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
import { CreateVehicleDto } from '../../dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../../dto/update-vehicle.dto';
import { QueryVehicleDto } from '../../dto/query-vehicle.dto';
import { VehicleEntity } from '../../infrastructure/persistence/relational/entities/vehicle.entity';
import { VehiclesService } from '../services/vehicles.service';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../../../utils/dto/infinity-pagination-response.dto';

@ApiBearerAuth()
@ApiTags('Vehicles')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'vehicles',
  version: '1',
})
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @ApiCreatedResponse({ type: VehicleEntity })
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request,
    @Body() dto: CreateVehicleDto,
  ): Promise<VehicleEntity> {
    return this.vehiclesService.create(request.user, dto);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(VehicleEntity) })
  @Roles(RoleEnum.admin, RoleEnum.owner, RoleEnum.driver)
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @Request() request,
    @Query() query: QueryVehicleDto,
  ): Promise<InfinityPaginationResponseDto<VehicleEntity>> {
    return this.vehiclesService.findMany(request.user, query);
  }

  @ApiOkResponse({ type: VehicleEntity })
  @Roles(RoleEnum.admin, RoleEnum.owner, RoleEnum.driver)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleEntity> {
    return this.vehiclesService.findOne(request.user, id);
  }

  @ApiOkResponse({ type: VehicleEntity })
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<VehicleEntity> {
    return this.vehiclesService.update(request.user, id, dto);
  }

  @ApiNoContentResponse()
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.vehiclesService.softDelete(request.user, id);
  }
}
