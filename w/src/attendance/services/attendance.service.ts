import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AttendanceRepository } from '../repository/attendance.repository';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto';
import { UserRepository } from '../../users/repositories/user.repository';
import { CourseRepository } from '../../courses/repositories/course.repository';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly attendanceRepo: AttendanceRepository,
    private readonly userRepo: UserRepository,
    private readonly courseRepo: CourseRepository,
  ) {}

  async create(dto: CreateAttendanceDto) {
    // Validate student
    const student = await this.userRepo.findById(dto.studentId);
    if (!student || student.userType !== Role.STUDENT) {
      throw new NotFoundException(`Student with ID ${dto.studentId} not found`);
    }

    // Validate course
    const course = await this.courseRepo.findById(dto.courseId);
    if (!course) {
      throw new NotFoundException(`Course with ID ${dto.courseId} not found`);
    }

    // Validate staff
    const staff = await this.userRepo.findById(dto.staffId);
    if (!staff || (staff.userType !== Role.STAFF && staff.userType !== Role.ADMIN)) {
      throw new NotFoundException(`Staff with ID ${dto.staffId} not found`);
    }

    // Validate attendance status
    if (![1, 2, 3, 4].includes(dto.attendanceStatusId)) {
      throw new BadRequestException('Invalid attendance status');
    }

    const section = dto.section || 1;
    const lectureType = dto.lectureType || 'lecture';
    const recordDate = this.normalizeDate(dto.recordDate);

    // Check for duplicate
    const existing = await this.attendanceRepo.findOneByStudentCourseDateSection(
      dto.studentId, dto.courseId, recordDate, section, lectureType
    );
    
    if (existing) {
      throw new ConflictException(`Attendance already recorded for student ${dto.studentId} in course ${dto.courseId} on ${dto.recordDate}`);
    }

    return this.attendanceRepo.create({
      recordDate,
      studentId: dto.studentId,
      student,
      courseId: dto.courseId,
      course,
      staffId: dto.staffId,
      attendanceStatusId: dto.attendanceStatusId,
      sectionNumber: section,
      sessionType: lectureType,
    });
  }

  async findAll(page: number = 1, limit: number = 50, courseId?: number, section?: number, date?: string) {
    const filters = { courseId, section, date: date ? this.normalizeDate(date) : undefined };
    return this.attendanceRepo.findAllWithFilters(page, limit, filters);
  }

  async findByStaff(staffId: number, page: number = 1, limit: number = 50, courseId?: number, section?: number, date?: string) {
    const courses = await this.courseRepo.findByInstructor(staffId);
    const courseIds = courses.map(c => c.courseId);
    
    if (courseId && !courseIds.includes(courseId)) {
      throw new ForbiddenException('You are not authorized to view attendance for this course');
    }
    
    const filters = { courseId, section, date: date ? this.normalizeDate(date) : undefined };
    return this.attendanceRepo.findAllWithFilters(page, limit, filters, courseIds);
  }

  async getStudentAttendance(studentId: number, courseId?: number) {
    const student = await this.userRepo.findById(studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    
    const records = await this.attendanceRepo.findByStudent(studentId, courseId);
    
    const courseStats = new Map();
    
    records.forEach(record => {
      const courseName = record.course?.name || `Course ${record.courseId}`;
      if (!courseStats.has(courseName)) {
        courseStats.set(courseName, {
          courseId: record.courseId,
          courseName,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          attendanceRate: 0
        });
      }
      
      const stats = courseStats.get(courseName);
      stats.total++;
      
      switch(record.attendanceStatusId) {
        case 1: stats.present++; break;
        case 2: stats.absent++; break;
        case 3: stats.late++; break;
        case 4: stats.excused++; break;
      }
      
      stats.attendanceRate = parseFloat(((stats.present + stats.late) / stats.total * 100).toFixed(2));
    });
    
    return {
      student: { id: studentId, username: student.username },
      courses: Array.from(courseStats.values()),
      records
    };
  }

  async getCourseAttendance(courseId: number, section?: number, date?: string) {
    const course = await this.courseRepo.findById(courseId);
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }
    
    const filters = { section, date: date ? this.normalizeDate(date) : undefined };
    const records = await this.attendanceRepo.findByCourse(courseId, filters);
    
    return {
      course: { 
        id: courseId, 
        name: course.name, 
        code: course.code, 
        schedule: course.schedule, 
        room: course.room 
      },
      totalRecords: records.length,
      records
    };
  }

  async getStatistics(courseId?: number) {
    return this.attendanceRepo.getStatistics(courseId);
  }

  async update(recordId: number, dto: UpdateAttendanceDto, userId: number, userRole: string) {
    const record = await this.attendanceRepo.findOneById(recordId);
    if (!record) {
      throw new NotFoundException(`Attendance record with ID ${recordId} not found`);
    }
    
    // Only admin or the staff who created can update
    if (userRole !== Role.ADMIN && record.staffId !== userId) {
      throw new ForbiddenException('You are not authorized to update this record');
    }
    
    // Convert string date to Date object if provided
    const updateData: any = { ...dto };
    if (dto.recordDate) {
      updateData.recordDate = this.normalizeDate(dto.recordDate);
    }
    
    return this.attendanceRepo.update(recordId, updateData);
  }

  async delete(recordId: number, userId: number, userRole: string) {
    const record = await this.attendanceRepo.findOneById(recordId);
    if (!record) {
      throw new NotFoundException(`Attendance record with ID ${recordId} not found`);
    }
    
    // Only admin can delete
    if (userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only administrators can delete attendance records');
    }
    
    return this.attendanceRepo.delete(recordId);
  }

  async isStaffAuthorizedForCourse(staffId: number, courseId: number): Promise<boolean> {
    const courses = await this.courseRepo.findByInstructor(staffId);
    return courses.some(c => c.courseId === courseId);
  }

  private normalizeDate(dateString: string): Date {
    return new Date(dateString + 'T00:00:00Z');
  }
}