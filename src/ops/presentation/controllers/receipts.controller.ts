import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../../roles/roles.decorator';
import { RolesGuard } from '../../../roles/roles.guard';
import { RoleEnum } from '../../../roles/roles.enum';
import { SubmitReceiptDto } from '../../dto/submit-receipt.dto';
import { RejectReceiptDto } from '../../dto/reject-receipt.dto';
import { ApproveReceiptDto } from '../../dto/approve-receipt.dto';
import { QueryReceiptDto } from '../../dto/query-receipt.dto';
import { ReceiptEntity } from '../../infrastructure/persistence/relational/entities/receipt.entity';
import { ReceiptsService } from '../services/receipts.service';
import { InfinityPaginationResponseDto } from '../../../utils/dto/infinity-pagination-response.dto';

@ApiBearerAuth()
@ApiTags('Receipts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'receipts',
  version: '1',
})
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @ApiOkResponse({
    description: 'Infinity pagination of receipts',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/ReceiptEntity' },
        },
        hasNextPage: { type: 'boolean' },
      },
    },
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(RoleEnum.driver, RoleEnum.owner, RoleEnum.admin)
  findMany(
    @Request() request,
    @Query() query: QueryReceiptDto,
  ): Promise<InfinityPaginationResponseDto<ReceiptEntity>> {
    return this.receiptsService.findMany(request.user, query);
  }

  @ApiOkResponse({ type: ReceiptEntity })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleEnum.driver, RoleEnum.owner, RoleEnum.admin)
  findOne(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReceiptEntity> {
    return this.receiptsService.findOne(request.user, id);
  }

  @ApiCreatedResponse({ type: ReceiptEntity })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleEnum.driver, RoleEnum.owner)
  submit(
    @Request() request,
    @Body() dto: SubmitReceiptDto,
  ): Promise<ReceiptEntity> {
    return this.receiptsService.submit(request.user, dto);
  }

  @ApiCreatedResponse({ type: ReceiptEntity })
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleEnum.admin, RoleEnum.owner)
  approve(
    @Request() request,
    @Param('id') receiptId: string,
    @Body() dto: ApproveReceiptDto,
  ): Promise<ReceiptEntity> {
    return this.receiptsService.approve(request.user, receiptId, dto);
  }

  @ApiCreatedResponse({ type: ReceiptEntity })
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleEnum.admin, RoleEnum.owner)
  reject(
    @Request() request,
    @Param('id') receiptId: string,
    @Body() dto: RejectReceiptDto,
  ): Promise<ReceiptEntity> {
    return this.receiptsService.reject(request.user, receiptId, dto);
  }
}
