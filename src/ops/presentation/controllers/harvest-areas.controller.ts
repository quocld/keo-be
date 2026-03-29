import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { HarvestAreaEntity } from '../../infrastructure/persistence/relational/entities/harvest-area.entity';
import { HarvestAreasService } from '../services/harvest-areas.service';
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
  constructor(private readonly harvestAreasService: HarvestAreasService) {}

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
