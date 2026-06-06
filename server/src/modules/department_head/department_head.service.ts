import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateDepartmentHeadDto } from './dto/create-department-head.dto';
import { UpdateDepartmentHeadDto } from './dto/update-department-head.dto';

@Injectable()
export class DepartmentHeadService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateDepartmentHeadDto) {
    return this.prisma.departmentHead.create({ data: dto });
  }

  findAll() {
    return this.prisma.departmentHead.findMany({
      orderBy: { lastName: 'asc' },
      include: { department: true },
    });
  }

  async findOne(id: string) {
    const head = await this.prisma.departmentHead.findUnique({
      where: { id },
      include: { department: true },
    });
    if (!head) {
      throw new NotFoundException(`Department head ${id} not found`);
    }
    return head;
  }

  async update(id: string, dto: UpdateDepartmentHeadDto) {
    await this.findOne(id);
    return this.prisma.departmentHead.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.departmentHead.delete({ where: { id } });
  }
}
