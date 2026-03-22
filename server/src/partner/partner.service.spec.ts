import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { Partner } from './entities/partner.entity';

@Injectable()
export class PartnerService {
  private partners: Partner[] = [
    { id: 1, name: 'Global Tech', website: 'https://globaltech.com' },
  ];
  private idCounter = 2;

  create(createPartnerDto: CreatePartnerDto) {
    const newPartner = { id: this.idCounter++, ...createPartnerDto };
    this.partners.push(newPartner);
    return newPartner;
  }

  findAll() {
    return this.partners;
  }

  findOne(id: number) {
    const partner = this.partners.find((p) => p.id === id);
    if (!partner)
      throw new NotFoundException(`Партнера з ID ${id} не знайдено`);
    return partner;
  }

  update(id: number, updatePartnerDto: UpdatePartnerDto) {
    const index = this.partners.findIndex((p) => p.id === id);
    if (index === -1)
      throw new NotFoundException(`Партнера з ID ${id} не знайдено`);

    this.partners[index] = { ...this.partners[index], ...updatePartnerDto };
    return this.partners[index];
  }

  remove(id: number) {
    const index = this.partners.findIndex((p) => p.id === id);

    if (index === -1)
      throw new NotFoundException(`Партнера з ID ${id} не знайдено`);

    return this.partners.splice(index, 1)[0];
  }
}
