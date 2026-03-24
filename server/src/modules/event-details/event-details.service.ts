import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateEventDetailDto } from './dto/create-event-detail.dto';
import { UpdateEventDetailDto } from './dto/update-event-detail.dto';
import { EventDetail } from './entities/event-detail.entity';

@Injectable()
export class EventDetailsService {
  private details: EventDetail[] = [
    {
      id: '1',
      eventId: '1',
      location: '˜˜˜˜˜˜˜˜ ˜˜˜',
      agenda: '?˜˜˜˜˜˜˜ ˜˜ ˜˜˜˜˜˜',
    },
  ];

  create(createEventDetailDto: CreateEventDetailDto) {
    const newDetail = { id: crypto.randomUUID(), ...createEventDetailDto };
    this.details.push(newDetail);
    return newDetail;
  }

  findAll() {
    return this.details;
  }

  findOne(id: string) {
    const detail = this.details.find((d) => d.id === id);
    if (!detail) throw new NotFoundException(`˜˜˜˜˜ ˜ ID ${id} ˜˜ ˜˜˜˜˜˜˜˜`);
    return detail;
  }

  update(id: string, updateEventDetailDto: UpdateEventDetailDto) {
    const index = this.details.findIndex((d) => d.id === id);
    if (index === -1)
      throw new NotFoundException(`˜˜˜˜˜ ˜ ID ${id} ˜˜ ˜˜˜˜˜˜˜˜`);

    this.details[index] = { ...this.details[index], ...updateEventDetailDto };
    return this.details[index];
  }

  remove(id: string) {
    const index = this.details.findIndex((d) => d.id === id);
    if (index === -1)
      throw new NotFoundException(`˜˜˜˜˜ ˜ ID ${id} ˜˜ ˜˜˜˜˜˜˜˜`);

    return this.details.splice(index, 1)[0];
  }
}
