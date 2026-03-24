import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { FundraiserService } from './fundraiser.service';
import { CreateFundraiserDto } from './dto/create-fundraiser.dto';
import { UpdateFundraiserDto } from './dto/update-fundraiser.dto';

@Controller('fundraiser')
export class FundraiserController {
  constructor(private readonly fundraiserService: FundraiserService) {}

  @Post()
  create(@Body() createFundraiserDto: CreateFundraiserDto) {
    return this.fundraiserService.create(createFundraiserDto);
  }

  @Get()
  findAll() {
    return this.fundraiserService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fundraiserService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFundraiserDto: UpdateFundraiserDto) {
    return this.fundraiserService.update(id, updateFundraiserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fundraiserService.remove(id);
  }
}
