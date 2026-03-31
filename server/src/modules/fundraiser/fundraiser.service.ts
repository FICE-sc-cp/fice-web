import { Injectable } from '@nestjs/common';
import { CreateFundraiserDto } from './dto/create-fundraiser.dto';
import { UpdateFundraiserDto } from './dto/update-fundraiser.dto';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class FundraiserService {
  create(createFundraiserDto: CreateFundraiserDto) {
    return 'This action adds a new fundraiser';
  }

  findAll() {
    return `This action returns all fundraiser`;
  }

  findOne(id: string) {
    return `This action returns a #${id} fundraiser`;
  }

  update(id: string, updateFundraiserDto: UpdateFundraiserDto) {
    return `This action updates a #${id} fundraiser`;
  }

  remove(id: string) {
    return `This action removes a #${id} fundraiser`;
  }
}
