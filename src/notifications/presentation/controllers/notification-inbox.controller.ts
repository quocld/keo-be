import {
  Controller,
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
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { QueryNotificationsDto } from '../dto/query-notifications.dto';
import { NotificationInboxItemDto } from '../dto/notification-inbox-item.dto';
import { NotificationsService } from '../services/notifications.service';

@ApiBearerAuth()
@ApiTags('Notifications')
@ApiExtraModels(NotificationInboxItemDto)
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'notifications',
  version: '1',
})
export class NotificationInboxController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOkResponse({
    description: 'In-app notification inbox (newest first).',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(NotificationInboxItemDto) },
        },
        hasNextPage: { type: 'boolean' },
      },
    },
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  findMany(
    @Request() request: { user: JwtPayloadType },
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.findManyForUser(request.user, query);
  }

  @ApiNoContentResponse({ description: 'Marked as read' })
  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @Request() request: { user: JwtPayloadType },
    @Param('id') id: string,
  ): Promise<void> {
    return this.notificationsService.markAsRead(request.user, id);
  }

  @ApiNoContentResponse({ description: 'All notifications marked read' })
  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@Request() request: { user: JwtPayloadType }): Promise<void> {
    return this.notificationsService.markAllAsRead(request.user);
  }
}
