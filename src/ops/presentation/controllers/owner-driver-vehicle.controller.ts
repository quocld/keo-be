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
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
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
import { SetDriverVehicleDto } from '../../dto/set-driver-vehicle.dto';
import { VehicleEntity } from '../../infrastructure/persistence/relational/entities/vehicle.entity';
import { OwnerDriverVehicleService } from '../services/owner-driver-vehicle.service';

@ApiBearerAuth()
@ApiTags('OwnerDriverVehicle')
@Roles(RoleEnum.owner)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'owner/drivers',
  version: '1',
})
export class OwnerDriverVehicleController {
  constructor(
    private readonly ownerDriverVehicleService: OwnerDriverVehicleService,
  ) {}

  @ApiOkResponse({ type: VehicleEntity })
  @ApiNoContentResponse({ description: 'No vehicle assigned to this driver' })
  @ApiParam({ name: 'driverId', type: Number })
  @Get(':driverId/vehicle')
  async get(
    @Res({ passthrough: true }) res: Response,
    @Request() request: { user: JwtPayloadType },
    @Param('driverId', ParseIntPipe) driverId: number,
  ): Promise<VehicleEntity | void> {
    const vehicle = await this.ownerDriverVehicleService.get(
      request.user,
      driverId,
    );
    if (!vehicle) {
      res.status(HttpStatus.NO_CONTENT);
      return;
    }
    return vehicle;
  }

  @ApiNoContentResponse({ description: 'Assignment updated' })
  @ApiParam({ name: 'driverId', type: Number })
  @Put(':driverId/vehicle')
  @HttpCode(HttpStatus.NO_CONTENT)
  async set(
    @Request() request: { user: JwtPayloadType },
    @Param('driverId', ParseIntPipe) driverId: number,
    @Body() dto: SetDriverVehicleDto,
  ): Promise<void> {
    await this.ownerDriverVehicleService.set(
      request.user,
      driverId,
      dto.vehicleId,
    );
  }
}
