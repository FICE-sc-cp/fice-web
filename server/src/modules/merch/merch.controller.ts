import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  READ_LIMIT_PER_IP,
  REGISTER_LIMIT_PER_IP,
  THROTTLE_TTL,
} from '../../common/throttle';
import { MerchCatalogService } from './merch-catalog.service';
import { MerchOrderService } from './merch-order.service';
import {
  CartDto,
  CreateOrderDto,
  MerchIdPipe,
  PickupDto,
  RecipientDto,
} from './merch.dto';

const READ_RATE = { default: { limit: READ_LIMIT_PER_IP, ttl: THROTTLE_TTL } };
const SUBMIT_RATE = {
  default: { limit: REGISTER_LIMIT_PER_IP, ttl: THROTTLE_TTL },
};

/**
 * Public catalog and customer routes. Every GET is no-store: the answer depends
 * on who asks, and the link poll hands out a session.
 */
@ApiTags('merch')
@ApiSecurity('telegram')
@Controller('merch')
export class MerchController {
  constructor(
    private readonly catalog: MerchCatalogService,
    private readonly orders: MerchOrderService,
  ) {}

  /** Groups of whoever is asking; a stale token never breaks browsing. */
  private async viewerGroups(req: Request) {
    return this.catalog.groupIds(await this.catalog.viewer(req));
  }

  @Get('catalog')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Products and filters this viewer can see' })
  async getCatalog(@Req() req: Request) {
    return this.catalog.catalog(await this.viewerGroups(req));
  }

  @Get('products/:id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'One product, 404 for outsiders of its groups' })
  async getProduct(@Req() req: Request, @Param('id', MerchIdPipe) id: number) {
    return this.catalog.product(id, await this.viewerGroups(req));
  }

  @Post('cart/preview')
  @HttpCode(200)
  @Throttle(READ_RATE)
  @ApiOperation({ summary: 'Price a device cart with live data' })
  async previewCart(@Req() req: Request, @Body() dto: CartDto) {
    return this.catalog.preview(dto.lines, await this.viewerGroups(req));
  }

  @Post('link')
  @Throttle(SUBMIT_RATE)
  @ApiOperation({ summary: 'Start linking this browser to Telegram' })
  startLink() {
    return this.catalog.startLink();
  }

  @Get('link/:token')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Poll a link; the session is issued once' })
  pollLink(@Param('token') token: string) {
    return this.catalog.pollLink(token);
  }

  @Delete('link')
  @ApiOperation({ summary: 'End this browser session' })
  endLink(@Headers('x-merch-token') session?: string) {
    return this.catalog.endLink(session);
  }

  @Post('checkout/start')
  @HttpCode(200)
  @Throttle(READ_RATE)
  @ApiOperation({ summary: 'Priced cart, recipients and payment details' })
  async startCheckout(@Req() req: Request, @Body() dto: CartDto) {
    const viewer = await this.catalog.customer(req);
    const groups = await this.catalog.groupIds(viewer);
    return this.orders.startCheckout(viewer, dto.lines, groups);
  }

  @Post('orders')
  @Throttle(SUBMIT_RATE)
  @ApiOperation({ summary: 'Create an order; a repeated key is the same one' })
  async createOrder(@Req() req: Request, @Body() dto: CreateOrderDto) {
    const viewer = await this.catalog.customer(req);
    const groups = await this.catalog.groupIds(viewer);
    return this.orders.createOrder(viewer, dto, groups);
  }

  @Get('orders')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Own orders, newest first' })
  async listOrders(@Req() req: Request) {
    const viewer = await this.catalog.customer(req);
    return { orders: await this.orders.listOrders(viewer) };
  }

  @Get('recipients')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Own saved recipients' })
  async listRecipients(@Req() req: Request) {
    const viewer = await this.catalog.customer(req);
    return { recipients: await this.catalog.recipients(viewer) };
  }

  @Post('recipients')
  @Throttle(SUBMIT_RATE)
  @ApiOperation({ summary: 'Save a recipient' })
  async addRecipient(@Req() req: Request, @Body() dto: RecipientDto) {
    return this.catalog.addRecipient(await this.catalog.customer(req), dto);
  }

  @Delete('recipients/:id')
  @ApiOperation({ summary: 'Delete a saved recipient' })
  async deleteRecipient(
    @Req() req: Request,
    @Param('id', MerchIdPipe) id: number,
  ) {
    return this.catalog.deleteRecipient(await this.catalog.customer(req), id);
  }

  @Post('recipients/:id/default')
  @ApiOperation({ summary: 'Make a saved recipient the default' })
  async defaultRecipient(
    @Req() req: Request,
    @Param('id', MerchIdPipe) id: number,
  ) {
    return this.catalog.defaultRecipient(await this.catalog.customer(req), id);
  }

  @Get('orders/:id/pickup')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Pickup state and open slots of an own order' })
  async pickupInfo(@Req() req: Request, @Param('id', MerchIdPipe) id: number) {
    return this.orders.pickupInfo(await this.catalog.customer(req), id);
  }

  @Post('orders/:id/pickup')
  @ApiOperation({ summary: 'Choose a pickup slot or individual pickup' })
  async choosePickup(
    @Req() req: Request,
    @Param('id', MerchIdPipe) id: number,
    @Body() dto: PickupDto,
  ) {
    return this.orders.choosePickup(await this.catalog.customer(req), id, dto);
  }
}
