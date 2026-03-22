import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event } from './entities/event.entity';

@Injectable()
export class EventService {
  // ZAGLUSHKA
  private events: Event[] = [
    {
      id: 1,
      title: '����� �������',
      description: '���� ������',
      date: new Date(),
    },
  ];
  private idCounter = 2; // new id Counter

  create(createEventDto: CreateEventDto) {
    const newEvent = {
      id: this.idCounter++,
      ...createEventDto,
    };
    this.events.push(newEvent);
    return newEvent;
  }

  findAll() {
    return this.events; //Returns all events
  }

  findOne(id: number) {
    const event = this.events.find((e) => e.id === id);
    if (!event) throw new NotFoundException(`���� � ID ${id} �� ��������`);
    return event;
  }

  update(id: number, updateEventDto: UpdateEventDto) {
    const eventIndex = this.events.findIndex((e) => e.id === id);
    if (eventIndex === -1)
      throw new NotFoundException(`���� � ID ${id} �� ��������`);

    // Data refresh
    this.events[eventIndex] = { ...this.events[eventIndex], ...updateEventDto };
    return this.events[eventIndex];
  }

  remove(id: number) {
    const eventIndex = this.events.findIndex((e) => e.id === id);
    if (eventIndex === -1)
      throw new NotFoundException(`���� � ID ${id} �� ��������`);

    const removed = this.events.splice(eventIndex, 1);
    return removed[0];
  }
}
