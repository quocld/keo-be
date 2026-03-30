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
import { RolesGuard } from '../../../roles/roles.guard';
import { Roles } from '../../../roles/roles.decorator';
import { RoleEnum } from '../../../roles/roles.enum';
import { AnalyticsService } from '../services/analytics.service';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { DashboardSummaryQueryDto } from '../dto/dashboard-summary-query.dto';

@ApiBearerAuth()
@ApiTags('Analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin, RoleEnum.owner, RoleEnum.driver)
@Controller({
  path: 'analytics/dashboard',
  version: '1',
})
export class DashboardController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Dashboard summary (analytics MVP)' })
  summary(
    @Request() request: { user: JwtPayloadType },
    @Query() query: DashboardSummaryQueryDto,
  ): Promise<any> {
    return this.analyticsService.getDashboardSummary(request.user, query);
  }
}
