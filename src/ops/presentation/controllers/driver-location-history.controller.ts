import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { DriverLocationsService } from '../services/driver-locations.service';

@ApiBearerAuth()
@ApiTags('DriverLocations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'drivers/me/locations',
  version: '1',
})
export class DriverLocationHistoryController {
  constructor(
    private readonly driverLocationsService: DriverLocationsService,
  ) {}

  @ApiOkResponse({
    description: 'Paged roaming location history (driver_locations).',
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(RoleEnum.driver)
  listMy(
    @Request() request: { user: JwtPayloadType },
    @Query() query: QueryDriverLocationHistoryDto,
  ) {
    return this.driverLocationsService.listMyLocations(request.user, query);
  }
}
