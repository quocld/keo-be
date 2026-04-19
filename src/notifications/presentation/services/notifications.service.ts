import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { infinityPagination } from '../../../utils/infinity-pagination';
import { InfinityPaginationResponseDto } from '../../../utils/dto/infinity-pagination-response.dto';
import { NotificationEntity } from '../../../ops/infrastructure/persistence/relational/entities/notification.entity';
import { ExpoPushQueue } from '../../infrastructure/queues/expo-push.queue';
import { type ExpoPushSendJobData } from '../../worker/expo-push-job.types';
import { NotificationInboxItemDto } from '../dto/notification-inbox-item.dto';
import { QueryNotificationsDto } from '../dto/query-notifications.dto';

type CreateNotificationAndEnqueueArgs = {
  userId: number;
  title: string;
  message: string;
  type: string | null;
  /** ID of the related entity (e.g. receiptId) for deep-linking from the inbox. */
  referenceId?: string | null;
  /**
   * Custom payload delivered to client when user taps the push.
   * Keep only IDs/short strings.
   */
  pushData: ExpoPushSendJobData['pushData'];
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    private readonly expoPushQueue: ExpoPushQueue,
  ) {}

  async createNotificationAndEnqueue(
    args: CreateNotificationAndEnqueueArgs,
  ): Promise<NotificationEntity> {
    const notification = this.notificationsRepository.create({
      user: { id: args.userId } as any,
      title: args.title,
      message: args.message,
      type: args.type,
      referenceId: args.referenceId ?? null,
      isRead: false,
    });

    const saved = await this.notificationsRepository.save(notification);

    await this.expoPushQueue.enqueueSend({
      notificationId: saved.id,
      pushData: args.pushData,
    });

    return saved;
  }

  async findManyForUser(
    actor: JwtPayloadType,
    query: QueryNotificationsDto,
  ): Promise<InfinityPaginationResponseDto<NotificationInboxItemDto>> {
    if (!actor?.id) {
      throw new UnauthorizedException();
    }

    const uid = Number(actor.id);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const qb = this.notificationsRepository
      .createQueryBuilder('n')
      .where('n.user_id = :uid', { uid })
      .orderBy('n.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.isRead !== undefined) {
      qb.andWhere('n.is_read = :ir', { ir: query.isRead });
    }

    const rows = await qb.getMany();
    const data: NotificationInboxItemDto[] = rows.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      referenceId: n.referenceId ?? null,
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));

    return infinityPagination(data, { page, limit });
  }

  async markAsRead(actor: JwtPayloadType, id: string): Promise<void> {
    if (!actor?.id) {
      throw new UnauthorizedException();
    }

    const res = await this.notificationsRepository
      .createQueryBuilder()
      .update(NotificationEntity)
      .set({ isRead: true })
      .where('id = :id', { id })
      .andWhere('user_id = :uid', { uid: Number(actor.id) })
      .execute();

    if (!res.affected) {
      throw new NotFoundException();
    }
  }

  async markAllAsRead(actor: JwtPayloadType): Promise<void> {
    if (!actor?.id) {
      throw new UnauthorizedException();
    }

    await this.notificationsRepository
      .createQueryBuilder()
      .update(NotificationEntity)
      .set({ isRead: true })
      .where('user_id = :uid', { uid: Number(actor.id) })
      .andWhere('is_read = false')
      .execute();
  }
}
