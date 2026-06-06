import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateDepartmentDetailsDto } from './dto/create-department-details.dto';
import { UpdateDepartmentDetailsDto } from './dto/update-department-details.dto';

@Injectable()
export class DepartmentDetailsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateDepartmentDetailsDto) {
    return this.prisma.departmentDetails.create({ data: dto });
  }

  findAll() {
    return this.prisma.departmentDetails.findMany({
      include: { department: true },
    });
  }

  async findOne(id: string) {
    const details = await this.prisma.departmentDetails.findUnique({
      where: { id },
      include: { department: true },
    });
    if (!details) {
      throw new NotFoundException(`Department details ${id} not found`);
    }
    return details;
  }

  async update(id: string, dto: UpdateDepartmentDetailsDto) {
    await this.findOne(id);
    return this.prisma.departmentDetails.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.departmentDetails.delete({ where: { id } });
  }
}
