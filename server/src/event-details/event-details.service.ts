import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateEventDetailDto } from './dto/create-event-detail.dto';
import { UpdateEventDetailDto } from './dto/update-event-detail.dto';
import { EventDetail } from './entities/event-detail.entity';

@Injectable()
export class EventDetailsService {
  private details: EventDetail[] = [
    {
      id: 1,
      eventId: 1,
      location: 'Головний зал',
      agenda: 'Відкриття та фуршет',
    },
  ];
  private idCounter = 2;

  create(createEventDetailDto: CreateEventDetailDto) {
    const newDetail = { id: this.idCounter++, ...createEventDetailDto };
    this.details.push(newDetail);
    return newDetail;
  }

  findAll() {
    return this.details;
  }

  findOne(id: number) {
    const detail = this.details.find((d) => d.id === id);
    if (!detail) throw new NotFoundException(`Деталі з ID ${id} не знайдено`);
    return detail;
  }

  update(id: number, updateEventDetailDto: UpdateEventDetailDto) {
    const index = this.details.findIndex((d) => d.id === id);
    if (index === -1)
      throw new NotFoundException(`Деталі з ID ${id} не знайдено`);

    this.details[index] = { ...this.details[index], ...updateEventDetailDto };
    return this.details[index];
  }

  remove(id: number) {
    const index = this.details.findIndex((d) => d.id === id);
    if (index === -1)
      throw new NotFoundException(`Деталі з ID ${id} не знайдено`);

    return this.details.splice(index, 1)[0];
  }
}
