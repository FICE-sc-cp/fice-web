import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly listInclude: Prisma.DepartmentInclude = {
    head: true,
    details: true,
  };

  private readonly detailInclude: Prisma.DepartmentInclude = {
    head: true,
    details: true,
    departmentMemberAssignments: { include: { member: true } },
    eventDetails: true,
  };

  private relationData(dto: CreateDepartmentDto | UpdateDepartmentDto) {
    const { headId, detailsId, ...rest } = dto;
    return {
      ...rest,
      ...(headId !== undefined ? { head: { connect: { id: headId } } } : {}),
      ...(detailsId !== undefined
        ? { details: { connect: { id: detailsId } } }
        : {}),
    };
  }

  create(dto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: this.relationData(dto) as Prisma.DepartmentCreateInput,
      include: this.detailInclude,
    });
  }

  findAll() {
    return this.prisma.department.findMany({
      include: this.listInclude,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: this.detailInclude,
    });
    if (!department) {
      throw new NotFoundException(`Department ${id} not found`);
    }
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findOne(id);
    return this.prisma.department.update({
      where: { id },
      data: this.relationData(dto),
      include: this.detailInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.department.delete({ where: { id } });
  }
}
