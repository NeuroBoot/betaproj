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
      relations: ['student', 'course', 'course.instructor']
    });
  }

  findByStudent(studentId: number) {
    return this.repo.find({
      where: { student: { userAccountId: studentId } },
      relations: ['student', 'course', 'course.instructor']
    });
  }

  findByStaff(staffId: number) {
    return this.repo.find({
      where: { course: { instructor: { userAccountId: staffId } } },
      relations: ['student', 'course', 'course.instructor']
    });
  }

  findByFilter(filter: { courseId: number; section: number; date: string }) {
    return this.repo.find({
      where: {
        course: { courseId: filter.courseId },
        sectionNumber: filter.section,
        recordDate: new Date(filter.date)
      },
      relations: ['student', 'course']
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

  statisticsByStaff(staffId: number) {
    return this.repo
      .createQueryBuilder('attendance')
      .leftJoin('attendance.course', 'course')
      .select('attendance.attendanceStatusId', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('course.instructor.userAccountId = :staffId', { staffId })
      .groupBy('attendance.attendanceStatusId')
      .getRawMany();
  }

  statisticsByStudent(studentId: number) {
    return this.repo
      .createQueryBuilder('attendance')
      .select('attendance.attendanceStatusId', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('attendance.studentId = :studentId', { studentId })
      .groupBy('attendance.attendanceStatusId')
      .getRawMany();
  }
}