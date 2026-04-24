import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Attendance } from '../entities/attendance.entity';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto';

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

  async findAllWithFilters(
    page: number, 
    limit: number, 
    filters: { courseId?: number; section?: number; date?: Date }, 
    courseIds?: number[]
  ): Promise<{ data: Attendance[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const where: any = {};
    
    if (courseIds && courseIds.length > 0) {
      where.courseId = In(courseIds);
    }
    if (filters.courseId) {
      where.courseId = filters.courseId;
    }
    if (filters.section) {
      where.sectionNumber = filters.section;
    }
    if (filters.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
      where.recordDate = Between(startOfDay, endOfDay);
    }
    
    const [data, total] = await this.repo.findAndCount({
      where,
      relations: ['student', 'course'],
      skip,
      take: limit,
      order: { recordDate: 'DESC', createdAt: 'DESC' }
    });
    
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOneByStudentCourseDateSection(
    studentId: number, 
    courseId: number, 
    date: Date, 
    section: number, 
    lectureType: string
  ) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.repo.findOne({
      where: {
        studentId,
        courseId,
        sectionNumber: section,
        sessionType: lectureType.toUpperCase(),
        recordDate: Between(startOfDay, endOfDay)
      }
    });
  }

  async findByStudent(studentId: number, courseId?: number) {
    const where: any = { studentId };
    if (courseId) {
      where.courseId = courseId;
    }
    
    return this.repo.find({
      where,
      relations: ['course'],
      order: { recordDate: 'DESC' }
    });
  }

  async findByCourse(courseId: number, filters: { section?: number; date?: Date }) {
    const where: any = { courseId };
    if (filters.section) {
      where.sectionNumber = filters.section;
    }
    if (filters.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
      where.recordDate = Between(startOfDay, endOfDay);
    }
    
    return this.repo.find({
      where,
      relations: ['student'],
      order: { recordDate: 'DESC' }
    });
  }

  async findOneById(recordId: number) {
    return this.repo.findOne({
      where: { recordId },
      relations: ['student', 'course']
    });
  }

  async update(recordId: number, data: Partial<Attendance> | UpdateAttendanceDto) {
    const updateData: any = { ...data };
    
    // Convert recordDate from string to Date if needed
    if (updateData.recordDate && typeof updateData.recordDate === 'string') {
      updateData.recordDate = new Date(updateData.recordDate + 'T00:00:00Z');
    }
    
    await this.repo.update(recordId, updateData);
    return this.findOneById(recordId);
  }

  async delete(recordId: number) {
    const record = await this.findOneById(recordId);
    if (!record) return null;
    return this.repo.remove(record);
  }

  async getStatistics(courseId?: number) {
    let queryBuilder = this.repo
      .createQueryBuilder('attendance')
      .select('attendance.attendanceStatusId', 'status')
      .addSelect('COUNT(*)', 'count');
    
    if (courseId) {
      queryBuilder = queryBuilder.where('attendance.courseId = :courseId', { courseId });
    }
    
    const rawStats = await queryBuilder
      .groupBy('attendance.attendanceStatusId')
      .getRawMany();
    
    const totalRecords = rawStats.reduce((sum, stat) => sum + parseInt(stat.count), 0);
    const statusMap: Record<number, string> = { 1: 'Present', 2: 'Absent', 3: 'Late', 4: 'Excused' };
    
    return {
      total: totalRecords,
      breakdown: rawStats.map(stat => ({
        statusId: parseInt(stat.status),
        statusName: statusMap[parseInt(stat.status)] || 'Unknown',
        count: parseInt(stat.count),
        percentage: totalRecords > 0 ? ((parseInt(stat.count) / totalRecords) * 100).toFixed(2) : '0'
      }))
    };
  }
}