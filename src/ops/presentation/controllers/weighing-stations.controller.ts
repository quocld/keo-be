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
import { CreateWeighingStationDto } from '../../dto/create-weighing-station.dto';
import { UpdateWeighingStationDto } from '../../dto/update-weighing-station.dto';
import { QueryWeighingStationDto } from '../../dto/query-weighing-station.dto';
import { WeighingStationEntity } from '../../infrastructure/persistence/relational/entities/weighing-station.entity';
import { WeighingStationsService } from '../services/weighing-stations.service';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../../../utils/dto/infinity-pagination-response.dto';

@ApiBearerAuth()
@ApiTags('WeighingStations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'weighing-stations',
  version: '1',
})
export class WeighingStationsController {
  constructor(
    private readonly weighingStationsService: WeighingStationsService,
  ) {}

  @ApiCreatedResponse({ type: WeighingStationEntity })
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request,
    @Body() dto: CreateWeighingStationDto,
  ): Promise<WeighingStationEntity> {
    return this.weighingStationsService.create(request.user, dto);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(WeighingStationEntity) })
  @Roles(RoleEnum.admin, RoleEnum.owner, RoleEnum.driver)
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @Request() request,
    @Query() query: QueryWeighingStationDto,
  ): Promise<InfinityPaginationResponseDto<WeighingStationEntity>> {
    return this.weighingStationsService.findMany(request.user, query);
  }

  @ApiOkResponse({ type: WeighingStationEntity })
  @Roles(RoleEnum.admin, RoleEnum.owner, RoleEnum.driver)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Request() request,
    @Param('id') id: string,
  ): Promise<WeighingStationEntity> {
    return this.weighingStationsService.findOne(request.user, id);
  }

  @ApiOkResponse({ type: WeighingStationEntity })
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request,
    @Param('id') id: string,
    @Body() dto: UpdateWeighingStationDto,
  ): Promise<WeighingStationEntity> {
    return this.weighingStationsService.update(request.user, id, dto);
  }

  @ApiNoContentResponse()
  @Roles(RoleEnum.admin, RoleEnum.owner)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() request, @Param('id') id: string): Promise<void> {
    return this.weighingStationsService.softDelete(request.user, id);
  }
}
