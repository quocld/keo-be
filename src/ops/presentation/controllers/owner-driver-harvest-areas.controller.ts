import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { Roles } from '../../../roles/roles.decorator';
import { RoleEnum } from '../../../roles/roles.enum';
import { RolesGuard } from '../../../roles/roles.guard';
import { SetDriverHarvestAreasDto } from '../../dto/set-driver-harvest-areas.dto';
import { HarvestAreaEntity } from '../../infrastructure/persistence/relational/entities/harvest-area.entity';
import { OwnerDriverHarvestAreasService } from '../services/owner-driver-harvest-areas.service';

@ApiBearerAuth()
@ApiTags('OwnerDriverHarvestAreas')
@Roles(RoleEnum.owner)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'owner/drivers',
  version: '1',
})
export class OwnerDriverHarvestAreasController {
  constructor(
    private readonly ownerDriverHarvestAreasService: OwnerDriverHarvestAreasService,
  ) {}

  @ApiOkResponse({ type: [HarvestAreaEntity] })
  @ApiParam({ name: 'driverId', type: Number })
  @Get(':driverId/harvest-areas')
  @HttpCode(HttpStatus.OK)
  list(
    @Request() request: { user: JwtPayloadType },
    @Param('driverId', ParseIntPipe) driverId: number,
  ): Promise<HarvestAreaEntity[]> {
    return this.ownerDriverHarvestAreasService.list(request.user, driverId);
  }

  @ApiNoContentResponse({ description: 'Assignments replaced' })
  @ApiParam({ name: 'driverId', type: Number })
  @Put(':driverId/harvest-areas')
  @HttpCode(HttpStatus.NO_CONTENT)
  async replace(
    @Request() request: { user: JwtPayloadType },
    @Param('driverId', ParseIntPipe) driverId: number,
    @Body() dto: SetDriverHarvestAreasDto,
  ): Promise<void> {
    await this.ownerDriverHarvestAreasService.replace(
      request.user,
      driverId,
      dto.harvestAreaIds,
    );
  }
}
