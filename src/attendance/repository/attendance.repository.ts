import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from '../entities/attendance.entity';

@Injectable()
export class AttendanceRepository {

  constructor(
    @InjectRepository(Attendance)
    private repo: Repository<Attendance>,
  ) {}

  create(data: Partial<Attendance>) {
    const record = this.repo.create(data);
    return this.repo.save(record);
  }

  findAll() {
    return this.repo.find({
      relations: ['student','course']
    });
  }

  statistics() {
    return this.repo
      .createQueryBuilder('attendance')
      .select('attendance.attendanceStatusId','status')
      .addSelect('COUNT(*)','count')
      .groupBy('attendance.attendanceStatusId')
      .getRawMany();
  }
}