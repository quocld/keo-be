import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { Roles } from '../../../roles/roles.decorator';
import { RoleEnum } from '../../../roles/roles.enum';
import { RolesGuard } from '../../../roles/roles.guard';
import { QueryDriverLocationHistoryDto } from '../../dto/query-driver-location-history.dto';
import { OwnerDriverLocationsService } from '../services/owner-driver-locations.service';

@ApiBearerAuth()
@ApiTags('OwnerDriverLocations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'owner/drivers/locations',
  version: '1',
})
export class OwnerDriverLocationsController {
  constructor(
    private readonly ownerDriverLocationsService: OwnerDriverLocationsService,
  ) {}

  @ApiOkResponse({
    description: 'Latest location for managed drivers (paged).',
  })
  @Get('latest')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleEnum.owner, RoleEnum.admin)
  async latest(
    @Request() request: { user: JwtPayloadType },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? Number(page) : 1;
    let l = limit ? Number(limit) : 50;
    if (l > 200) {
      l = 200;
    }
    if (l < 1) {
      l = 1;
    }
    const data =
      await this.ownerDriverLocationsService.getLatestLocationsForVisibleDrivers(
        request.user,
        p,
        l,
      );
    return {
      data,
      page: p,
      limit: l,
    };
  }

  @ApiOkResponse({
    description:
      'Paged driver roaming history (driver_locations) for a managed driver.',
  })
  @Get(':driverId/history')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleEnum.owner, RoleEnum.admin)
  history(
    @Request() request: { user: JwtPayloadType },
    @Param('driverId') driverId: string,
    @Query() query: QueryDriverLocationHistoryDto,
  ) {
    return this.ownerDriverLocationsService.listDriverLocationHistory(
      request.user,
      Number(driverId),
      query,
    );
  }
}
