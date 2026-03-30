import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../../roles/roles.decorator';
import { RolesGuard } from '../../../roles/roles.guard';
import { RoleEnum } from '../../../roles/roles.enum';
import { AnalyticsService } from '../services/analytics.service';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { AnalyticsRangeQueryDto } from '../dto/range-query.dto';

@ApiBearerAuth()
@ApiTags('Analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin, RoleEnum.owner, RoleEnum.driver)
@Controller({
  path: 'analytics',
  version: '1',
})
export class DetailsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('drivers/me/detail')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Driver detail (analytics MVP)' })
  driverMeDetail(
    @Request() request: { user: JwtPayloadType },
    @Query() query: AnalyticsRangeQueryDto,
  ): Promise<any> {
    return this.analyticsService.getDriverMeDetail(request.user, query);
  }

  @Get('drivers/:driverId/detail')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Driver detail by id (analytics MVP)' })
  driverDetail(
    @Request() request: { user: JwtPayloadType },
    @Param('driverId', ParseIntPipe) driverId: number,
    @Query() query: AnalyticsRangeQueryDto,
  ): Promise<any> {
    return this.analyticsService.getDriverDetail(request.user, driverId, query);
  }

  @Get('weighing-stations/:id/detail')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Weighing station detail (analytics MVP)' })
  weighingStationDetail(
    @Request() request: { user: JwtPayloadType },
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AnalyticsRangeQueryDto,
  ): Promise<any> {
    return this.analyticsService.getWeighingStationDetail(
      request.user,
      id,
      query,
    );
  }

  @Get('harvest-areas/:id/detail')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Harvest area detail (analytics MVP)' })
  harvestAreaDetail(
    @Request() request: { user: JwtPayloadType },
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AnalyticsRangeQueryDto,
  ): Promise<any> {
    return this.analyticsService.getHarvestAreaDetail(request.user, id, query);
  }
}
