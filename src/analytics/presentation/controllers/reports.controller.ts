import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { ReceiptsReportQueryDto } from '../dto/receipts-report-query.dto';
import { FinanceReportQueryDto } from '../dto/finance-report-query.dto';
import { TripsReportQueryDto } from '../dto/trips-report-query.dto';

@ApiBearerAuth()
@ApiTags('Analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin, RoleEnum.owner, RoleEnum.driver)
@Controller({
  path: 'analytics/reports',
  version: '1',
})
export class ReportsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('receipts')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Receipts report (analytics MVP)' })
  receiptsReport(
    @Request() request: { user: JwtPayloadType },
    @Query() query: ReceiptsReportQueryDto,
  ): Promise<any> {
    return this.analyticsService.getReceiptsReport(request.user, query);
  }

  @Get('finance')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Finance report (analytics MVP)' })
  financeReport(
    @Request() request: { user: JwtPayloadType },
    @Query() query: FinanceReportQueryDto,
  ): Promise<any> {
    return this.analyticsService.getFinanceReport(request.user, query);
  }

  @Get('trips')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Trips report (analytics MVP)' })
  tripsReport(
    @Request() request: { user: JwtPayloadType },
    @Query() query: TripsReportQueryDto,
  ): Promise<any> {
    return this.analyticsService.getTripsReport(request.user, query);
  }
}
