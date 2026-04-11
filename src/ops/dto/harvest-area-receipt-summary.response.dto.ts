import { ApiProperty } from '@nestjs/swagger';

export class HarvestAreaReceiptSummaryDto {
  @ApiProperty({ description: 'Số phiếu đã duyệt' })
  approvedCount: number;

  @ApiProperty({ description: 'Tổng trọng lượng (tấn) phiếu đã duyệt' })
  approvedTotalWeight: number;

  @ApiProperty({ description: 'Tổng số tiền (VNĐ) phiếu đã duyệt' })
  approvedTotalAmount: number;

  @ApiProperty({ description: 'Số phiếu đang chờ duyệt' })
  pendingCount: number;

  @ApiProperty({ description: 'Tổng số phiếu (mọi trạng thái)' })
  totalCount: number;
}
