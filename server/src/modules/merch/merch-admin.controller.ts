import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiConsumes,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { MAX_UPLOAD_BYTES } from '../../upload/upload.constants';
import { toResult, uploadInterceptor } from '../../upload/upload.controller';
import { MerchAdminGuard } from './merch-admin.guard';
import { MerchAdminService } from './merch-admin.service';
import type { LabelKind } from './merch-admin.service';
import {
  ActiveDto,
  GroupDto,
  IdsDto,
  LabelDto,
  MembersDto,
  MerchIdPipe,
  MerchKindPipe,
  ProductDto,
  SlotDto,
  TemplateDto,
} from './merch.dto';

const merchPhotoUpload = uploadInterceptor(
  { 'image/jpeg': ['.jpg', '.jpeg'] },
  MAX_UPLOAD_BYTES,
  'Дозволені лише JPEG.',
);

/** The guard sits on the class, so a new route cannot forget it. */
@ApiTags('merch-admin')
@ApiSecurity('telegram')
@UseGuards(MerchAdminGuard)
@Controller('merch/admin')
export class MerchAdminController {
  constructor(
    private readonly admin: MerchAdminService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('check')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Is the caller an admin of the bound chat' })
  check() {
    return { isAdmin: true };
  }

  @Get('state')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Everything the admin screens show' })
  state() {
    return this.admin.state();
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a product photo the browser prepared' })
  @UseInterceptors(merchPhotoUpload)
  async upload(@UploadedFile() file?: Express.Multer.File) {
    // Magic bytes only, no re-encode: the browser already did it, and the Jimp
    // fallback would block the API and all four bots.
    const { filename, url } = toResult(file);
    const now = new Date();
    await this.prisma.publicUpload.create({
      data: {
        filename,
        size: file!.size,
        ipHash: 'merch-admin', // keeps these out of any IP quota
        createdAt: now,
        unreferencedSince: now,
      },
    });
    return { url };
  }

  // ---- Products -------------------------------------------------------------

  @Post('products')
  @ApiOperation({ summary: 'Create a product, it shows first' })
  createProduct(@Body() dto: ProductDto) {
    return this.admin.createProduct(dto);
  }

  @Post('products/reorder')
  @ApiOperation({ summary: 'Reorder the visible subset of products' })
  reorderProducts(@Body() dto: IdsDto) {
    return this.admin.reorderProducts(dto.ids);
  }

  @Put('products/:id')
  @ApiOperation({ summary: 'Save a product; sold stock is never overwritten' })
  updateProduct(@Param('id', MerchIdPipe) id: number, @Body() dto: ProductDto) {
    return this.admin.updateProduct(id, dto);
  }

  @Patch('products/:id/active')
  @ApiOperation({ summary: 'Archive or activate a product' })
  setActive(@Param('id', MerchIdPipe) id: number, @Body() dto: ActiveDto) {
    return this.admin.setActive(id, dto.isActive);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Hard delete a product, order history stays' })
  deleteProduct(@Param('id', MerchIdPipe) id: number) {
    return this.admin.deleteProduct(id);
  }

  // ---- Categories and tags --------------------------------------------------

  @Post('labels/:kind')
  @ApiOperation({ summary: 'Create a category or a tag' })
  createLabel(
    @Param('kind', MerchKindPipe) kind: LabelKind,
    @Body() dto: LabelDto,
  ) {
    return this.admin.createLabel(kind, dto.name);
  }

  @Post('labels/:kind/reorder')
  @ApiOperation({ summary: 'Reorder categories or tags' })
  reorderLabels(
    @Param('kind', MerchKindPipe) kind: LabelKind,
    @Body() dto: IdsDto,
  ) {
    return this.admin.reorderLabels(kind, dto.ids);
  }

  @Patch('labels/:kind/:id')
  @ApiOperation({ summary: 'Rename a category or a tag' })
  renameLabel(
    @Param('kind', MerchKindPipe) kind: LabelKind,
    @Param('id', MerchIdPipe) id: number,
    @Body() dto: LabelDto,
  ) {
    return this.admin.renameLabel(kind, id, dto.name);
  }

  @Delete('labels/:kind/:id')
  @ApiOperation({ summary: 'Delete a category or a tag' })
  deleteLabel(
    @Param('kind', MerchKindPipe) kind: LabelKind,
    @Param('id', MerchIdPipe) id: number,
  ) {
    return this.admin.deleteLabel(kind, id);
  }

  // ---- Templates ------------------------------------------------------------

  @Post('templates')
  @ApiOperation({ summary: 'Create a product template' })
  createTemplate(@Body() dto: TemplateDto) {
    return this.admin.createTemplate(dto);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Save a template; products keep their values' })
  updateTemplate(
    @Param('id', MerchIdPipe) id: number,
    @Body() dto: TemplateDto,
  ) {
    return this.admin.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete a template' })
  deleteTemplate(@Param('id', MerchIdPipe) id: number) {
    return this.admin.deleteTemplate(id);
  }

  // ---- Groups ---------------------------------------------------------------

  @Post('groups')
  @ApiOperation({ summary: 'Create a user group' })
  createGroup(@Body() dto: GroupDto) {
    return this.admin.createGroup(dto.name);
  }

  @Delete('groups/:id')
  @ApiOperation({ summary: 'Delete a group no product depends on alone' })
  deleteGroup(@Param('id', MerchIdPipe) id: number) {
    return this.admin.deleteGroup(id);
  }

  @Post('groups/:id/members')
  @ApiOperation({ summary: 'Add members by Telegram id or @username' })
  addMembers(@Param('id', MerchIdPipe) id: number, @Body() dto: MembersDto) {
    return this.admin.addMembers(id, dto.values);
  }

  @Delete('groups/:id/members/:memberId')
  @ApiOperation({ summary: 'Remove a group member' })
  removeMember(
    @Param('id', MerchIdPipe) id: number,
    @Param('memberId', MerchIdPipe) memberId: number,
  ) {
    return this.admin.removeMember(id, memberId);
  }

  // ---- Pickup slots ---------------------------------------------------------

  @Post('slots')
  @ApiOperation({ summary: 'Create a pickup slot' })
  createSlot(@Body() dto: SlotDto) {
    return this.admin.createSlot(dto);
  }

  @Delete('slots/:id')
  @ApiOperation({ summary: 'Delete a slot, or switch it off if it has orders' })
  deleteSlot(@Param('id', MerchIdPipe) id: number) {
    return this.admin.deleteSlot(id);
  }
}
