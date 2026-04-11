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
import { CreateHarvestAreaDto } from '../../dto/create-harvest-area.dto';
import { UpdateHarvestAreaDto } from '../../dto/update-harvest-area.dto';
import { QueryHarvestAreaDto } from '../../dto/query-harvest-area.dto';
import { CreateHarvestAreaCostEntryDto } from '../../dto/create-harvest-area-cost-entry.dto';
import { UpdateHarvestAreaCostEntryDto } from '../../dto/update-harvest-area-cost-entry.dto';
import { QueryHarvestAreaCostEntriesDto } from '../../dto/query-harvest-area-cost-entries.dto';
import { QueryTripsByHarvestAreaDto } from '../../dto/query-trips-by-harvest-area.dto';
import { QueryReceiptsByHarvestAreaDto } from '../../dto/query-receipts-by-harvest-area.dto';
import { HarvestAreaReceiptSummaryDto } from '../../dto/harvest-area-receipt-summary.response.dto';
import { HarvestAreaEntity } from '../../infrastructure/persistence/relational/entities/harvest-area.entity';
import { HarvestAreaCostEntryEntity } from '../../infrastructure/persistence/relational/entities/harvest-area-cost-entry.entity';
import { ReceiptEntity } from '../../infrastructure/persistence/relational/entities/receipt.entity';
import { TripEntity } from '../../infrastructure/persistence/relational/entities/trip.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/relational/entities/user.entity';
import { HarvestAreasService } from '../services/harvest-areas.service';
import { HarvestAreaCostEntriesService } from '../services/harvest-area-cost-entries.service';
import { TripsService } from '../services/trips.service';
import { ReceiptsService } from '../services/receipts.service';
import { InfinityPaginationResponse } from '../../../utils/dto/infinity-pagination-response.dto';
import { InfinityPaginationResponseDto } from '../../../utils/dto/infinity-pagination-response.dto';

@ApiBearerAuth()
@ApiTags('HarvestAreas')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'harvest-areas',
  version: '1',
})
export class HarvestAreasController {
  constructor(
    private readonly harvestAreasService: HarvestAreasService,
    private readonly tripsService: TripsService,
    private readonly harvestAreaCostEntriesService: HarvestAreaCostEntriesService,
    private readonly receiptsService: ReceiptsService,
  ) {}

  @ApiCreatedResponse({ type: HarvestAreaEntity })
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request,
    @Body() dto: CreateHarvestAreaDto,
  ): Promise<HarvestAreaEntity> {
    return this.harvestAreasService.create(request.user, dto);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(HarvestAreaEntity) })
  @Roles(RoleEnum.admin, RoleEnum.owner, RoleEnum.driver)
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @Request() request,
    @Query() query: QueryHarvestAreaDto,
  ): Promise<InfinityPaginationResponseDto<HarvestAreaEntity>> {
    return this.harvestAreasService.findMany(request.user, query);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(TripEntity) })
  @Roles(RoleEnum.admin, RoleEnum.owner, RoleEnum.driver)
  @Get(':id/trips')
  @HttpCode(HttpStatus.OK)
  tripsByHarvestArea(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryTripsByHarvestAreaDto,
  ): Promise<InfinityPaginationResponseDto<TripEntity>> {
    return this.tripsService.findManyByHarvestArea(request.user, id, query);
  }

  @ApiOkResponse({ type: [UserEntity] })
  @Roles(RoleEnum.admin, RoleEnum.owner, RoleEnum.driver)
  @Get(':id/drivers')
  @HttpCode(HttpStatus.OK)
  driversByHarvestArea(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserEntity[]> {
    return this.harvestAreasService.findDriversForHarvestArea(request.user, id);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(ReceiptEntity) })
  @Roles(RoleEnum.admin, RoleEnum.owner, RoleEnum.driver)
  @Get(':id/receipts')
  @HttpCode(HttpStatus.OK)
  receiptsByHarvestArea(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryReceiptsByHarvestAreaDto,
  ): Promise<InfinityPaginationResponseDto<ReceiptEntity>> {
    return this.receiptsService.findManyByHarvestArea(request.user, id, query);
  }

  @ApiOkResponse({ type: HarvestAreaReceiptSummaryDto })
  @Roles(RoleEnum.admin, RoleEnum.owner, RoleEnum.driver)
  @Get(':id/receipt-summary')
  @HttpCode(HttpStatus.OK)
  receiptSummary(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<HarvestAreaReceiptSummaryDto> {
    return this.receiptsService.getReceiptSummaryByHarvestArea(
      request.user,
      id,
    );
  }

  @ApiOkResponse({
    type: InfinityPaginationResponse(HarvestAreaCostEntryEntity),
  })
  @Roles(RoleEnum.admin, RoleEnum.owner, RoleEnum.driver)
  @Get(':id/cost-entries')
  @HttpCode(HttpStatus.OK)
  listCostEntries(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryHarvestAreaCostEntriesDto,
  ): Promise<InfinityPaginationResponseDto<HarvestAreaCostEntryEntity>> {
    return this.harvestAreaCostEntriesService.findMany(request.user, id, query);
  }

  @ApiCreatedResponse({ type: HarvestAreaCostEntryEntity })
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Post(':id/cost-entries')
  @HttpCode(HttpStatus.CREATED)
  createCostEntry(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateHarvestAreaCostEntryDto,
  ): Promise<HarvestAreaCostEntryEntity> {
    return this.harvestAreaCostEntriesService.create(request.user, id, dto);
  }

  @ApiOkResponse({ type: HarvestAreaCostEntryEntity })
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Patch(':id/cost-entries/:entryId')
  @HttpCode(HttpStatus.OK)
  updateCostEntry(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: UpdateHarvestAreaCostEntryDto,
  ): Promise<HarvestAreaCostEntryEntity> {
    return this.harvestAreaCostEntriesService.update(
      request.user,
      id,
      entryId,
      dto,
    );
  }

  @ApiNoContentResponse()
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Delete(':id/cost-entries/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCostEntry(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ): Promise<void> {
    await this.harvestAreaCostEntriesService.remove(request.user, id, entryId);
  }

  @ApiOkResponse({ type: HarvestAreaEntity })
  @Roles(RoleEnum.admin, RoleEnum.owner, RoleEnum.driver)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Request() request,
    @Param('id') id: string,
  ): Promise<HarvestAreaEntity> {
    return this.harvestAreasService.findOne(request.user, id);
  }

  @ApiOkResponse({ type: HarvestAreaEntity })
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request,
    @Param('id') id: string,
    @Body() dto: UpdateHarvestAreaDto,
  ): Promise<HarvestAreaEntity> {
    return this.harvestAreasService.update(request.user, id, dto);
  }

  @ApiNoContentResponse()
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() request, @Param('id') id: string): Promise<void> {
    return this.harvestAreasService.softDelete(request.user, id);
  }
}
