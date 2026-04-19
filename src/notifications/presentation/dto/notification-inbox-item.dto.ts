import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationInboxItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional({ nullable: true })
  type: string | null;

  @ApiPropertyOptional({ nullable: true })
  referenceId: string | null;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty()
  createdAt: Date;
}
