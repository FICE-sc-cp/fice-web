import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateDepartmentMemberDto } from './dto/create-department-member.dto';
import { UpdateDepartmentMemberDto } from './dto/update-department-member.dto';

@Injectable()
export class DepartmentMemberService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateDepartmentMemberDto) {
    return this.prisma.departmentMember.create({ data: dto });
  }

  findAll() {
    return this.prisma.departmentMember.findMany({
      orderBy: { lastName: 'asc' },
      include: { assignments: { include: { department: true } } },
    });
  }

  async findOne(id: string) {
    const member = await this.prisma.departmentMember.findUnique({
      where: { id },
      include: { assignments: { include: { department: true } } },
    });
    if (!member) {
      throw new NotFoundException(`Department member ${id} not found`);
    }
    return member;
  }

  async update(id: string, dto: UpdateDepartmentMemberDto) {
    await this.findOne(id);
    return this.prisma.departmentMember.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.departmentMember.delete({ where: { id } });
  }

  async assignToDepartment(memberId: string, departmentId: string) {
    await this.findOne(memberId);
    const existing = await this.prisma.departmentMemberAssignment.findFirst({
      where: { memberId, departmentId },
    });
    if (existing) {
      throw new ConflictException(
        `Member ${memberId} is already assigned to department ${departmentId}`,
      );
    }
    return this.prisma.departmentMemberAssignment.create({
      data: {
        member: { connect: { id: memberId } },
        department: { connect: { id: departmentId } },
      },
    });
  }

  async removeFromDepartment(memberId: string, departmentId: string) {
    const assignment = await this.prisma.departmentMemberAssignment.findFirst({
      where: { memberId, departmentId },
    });
    if (!assignment) {
      throw new NotFoundException(
        `Member ${memberId} is not assigned to department ${departmentId}`,
      );
    }
    return this.prisma.departmentMemberAssignment.delete({
      where: { id: assignment.id },
    });
  }
}
