import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../../roles/roles.decorator';
import { RolesGuard } from '../../../roles/roles.guard';
import { RoleEnum } from '../../../roles/roles.enum';
import { CreateTripDto } from '../../dto/create-trip.dto';
import { QueryTripDto } from '../../dto/query-trip.dto';
import { TripEntity } from '../../infrastructure/persistence/relational/entities/trip.entity';
import { TripsService } from '../services/trips.service';
import { InfinityPaginationResponseDto } from '../../../utils/dto/infinity-pagination-response.dto';

@ApiBearerAuth()
@ApiTags('Trips')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'trips',
  version: '1',
})
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @ApiOkResponse({
    description: 'Infinity pagination of trips',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/TripEntity' },
        },
        hasNextPage: { type: 'boolean' },
      },
    },
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(RoleEnum.driver, RoleEnum.owner, RoleEnum.admin)
  findMany(
    @Request() request,
    @Query() query: QueryTripDto,
  ): Promise<InfinityPaginationResponseDto<TripEntity>> {
    return this.tripsService.findMany(request.user, query);
  }

  @ApiCreatedResponse({ type: TripEntity })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleEnum.driver)
  create(@Request() request, @Body() dto: CreateTripDto): Promise<TripEntity> {
    return this.tripsService.create(request.user, dto);
  }

  @ApiOkResponse({ type: TripEntity })
  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleEnum.driver)
  start(@Request() request, @Param('id') tripId: string): Promise<TripEntity> {
    return this.tripsService.start(request.user, tripId);
  }

  @ApiOkResponse({ type: TripEntity })
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleEnum.driver, RoleEnum.owner, RoleEnum.admin)
  complete(
    @Request() request,
    @Param('id') tripId: string,
  ): Promise<TripEntity> {
    return this.tripsService.complete(request.user, tripId);
  }

  @ApiOkResponse({ type: TripEntity })
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleEnum.driver, RoleEnum.owner, RoleEnum.admin)
  cancel(@Request() request, @Param('id') tripId: string): Promise<TripEntity> {
    return this.tripsService.cancel(request.user, tripId);
  }
}
