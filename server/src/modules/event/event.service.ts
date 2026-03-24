import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event } from './entities/event.entity';

@Injectable()
export class EventService {
  private events: Event[] = [
    {
      id: '1',
      title: '����� �������',
      description: '���� ������',
      date: new Date(),
    },
  ];

  create(createEventDto: CreateEventDto) {
    const newEvent = {
      id: crypto.randomUUID(),
      ...createEventDto,
    };
    this.events.push(newEvent);
    return newEvent;
  }

  findAll() {
    return this.events; //Returns all events
  }

  findOne(id: string) {
    const event = this.events.find((e) => e.id === id);
    if (!event) throw new NotFoundException(`���� � ID ${id} �� ��������`);
    return event;
  }

  update(id: string, updateEventDto: UpdateEventDto) {
    const eventIndex = this.events.findIndex((e) => e.id === id);
    if (eventIndex === -1)
      throw new NotFoundException(`���� � ID ${id} �� ��������`);

    this.events[eventIndex] = { ...this.events[eventIndex], ...updateEventDto };
    return this.events[eventIndex];
  }

  remove(id: string) {
    const eventIndex = this.events.findIndex((e) => e.id === id);
    if (eventIndex === -1)
      throw new NotFoundException(`���� � ID ${id} �� ��������`);

    const removed = this.events.splice(eventIndex, 1);
    return removed[0];
  }
}
