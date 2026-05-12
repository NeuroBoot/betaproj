import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseRepository } from '../repositories/course.repository';
import { UserRepository } from '../../users/repositories/user.repository';
import { CreateCourseDto } from '../dto/create-course.dto';
import { UpdateCourseDto } from '../dto/update-course.dto';
import { Course } from '../entities/course.entity';
import { CourseEnrollment } from '../entities/course-enrollment.entity';
import { Role } from '../../common/enums/role.enum';
import { UserAccount } from '../../users/entities/user.entity';

@Injectable()
export class CoursesService {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly userRepository: UserRepository,
    @InjectRepository(CourseEnrollment)
    private readonly enrollmentRepository: Repository<CourseEnrollment>,
  ) {}

  async create(createCourseDto: CreateCourseDto, adminUser?: UserAccount): Promise<Course> {
    const existingCourse = await this.courseRepository.findByCodeAll(createCourseDto.code);
    
    if (existingCourse) {
      if (!existingCourse.isDeleted) {
        throw new ConflictException(`Course with code ${createCourseDto.code} already exists`);
      }
      
      // If it exists but is deleted, we can "restore" it to satisfy the user's request
      // to "add it again". This also avoids unique constraint issues.
      Object.assign(existingCourse, {
        ...createCourseDto,
        instructor: await this.userRepository.findById(createCourseDto.instructorId),
        isDeleted: false,
      });

      if (createCourseDto.adminId) {
        existingCourse.admin = await this.userRepository.findById(createCourseDto.adminId);
      } else if (adminUser) {
        existingCourse.admin = adminUser;
      }
      
      // Validation for instructor and admin (already done partially but to be safe)
      if (!existingCourse.instructor || existingCourse.instructor.userType !== Role.STAFF) {
        throw new NotFoundException(`Staff with ID ${createCourseDto.instructorId} not found`);
      }

      existingCourse.enrollments = [];
      return this.courseRepository.save(existingCourse);
    }

    const instructor = await this.userRepository.findById(createCourseDto.instructorId);
    if (!instructor || instructor.userType !== Role.STAFF) {
      throw new NotFoundException(`Staff with ID ${createCourseDto.instructorId} not found or is not a staff member`);
    }

    let admin = adminUser;
    if (createCourseDto.adminId) {
      admin = await this.userRepository.findById(createCourseDto.adminId);
      if (!admin || admin.userType !== Role.ADMIN) {
        throw new NotFoundException(`Admin with ID ${createCourseDto.adminId} not found`);
      }
    }

    const course = this.courseRepository.create({
      ...createCourseDto,
      instructor,
      admin,
    });

    return this.courseRepository.save(course);
  }

  async findAll(user: UserAccount): Promise<any[]> {
    let courses: Course[] = [];
    if (user.userType === Role.ADMIN) {
      courses = await this.courseRepository.findAllActive();
    } else if (user.userType === Role.STAFF) {
      courses = await this.courseRepository.findByInstructor(user.userAccountId);
    } else if (user.userType === Role.STUDENT) {
      courses = await this.courseRepository.findByStudent(user.userAccountId);
    } else {
      return [];
    }

    return courses.map(course => {
      const enrollments = course.enrollments || [];
      const sections = [...new Set(enrollments.map(e => e.section).filter(Boolean))].sort();
      const lectures = [...new Set(enrollments.map(e => e.lecture).filter(Boolean))].sort();

      // If no sections in enrollments but course.sections > 0, fallback to numeric
      if (sections.length === 0 && course.sections > 0) {
        for (let i = 1; i <= course.sections; i++) {
          sections.push(String(i));
        }
      }

      return {
        ...course,
        data: {
          sections,
          lectures
        }
      };
    });
  }

  async findOne(id: number, user: UserAccount): Promise<Course> {
    const course = await this.courseRepository.findOne({
      where: { courseId: id, isDeleted: false },
      relations: ['instructor', 'admin', 'enrollments', 'enrollments.student'],
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    // Permission check
    if (user.userType === Role.STAFF && course.instructor.userAccountId !== user.userAccountId) {
      throw new ForbiddenException(`Access Denied: As an instructor, you only have access to your own courses. This course (${course.name}) is assigned to another staff member.`);
    }

    if (user.userType === Role.STUDENT) {
      const isEnrolled = course.enrollments.some(e => e.studentId === user.userAccountId);
      if (!isEnrolled) {
        throw new ForbiddenException('You are not enrolled in this course');
      }
    }

    return course;
  }

  async findOneByCode(code: string, user: UserAccount): Promise<Course> {
    const course = await this.courseRepository.findOne({
      where: { code, isDeleted: false },
      relations: ['instructor', 'admin', 'enrollments', 'enrollments.student'],
    });

    if (!course) {
      throw new NotFoundException(`Course with code ${code} not found`);
    }

    // Permission check
    if (user.userType === Role.STAFF && course.instructor.userAccountId !== user.userAccountId) {
      throw new ForbiddenException(`Access Denied: As an instructor, you only have access to your own courses. This course (${course.name}) is assigned to another staff member.`);
    }

    return course;
  }

  async updateByCode(code: string, updateCourseDto: UpdateCourseDto): Promise<Course> {
    const course = await this.courseRepository.findByCode(code);
    if (!course) {
      throw new NotFoundException(`Course with code ${code} not found`);
    }
    return this.update(course.courseId, updateCourseDto);
  }

  async update(id: number, updateCourseDto: UpdateCourseDto): Promise<Course> {
    const course = await this.courseRepository.findById(id);
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    if (updateCourseDto.code && updateCourseDto.code !== course.code) {
      const existing = await this.courseRepository.findByCodeAll(updateCourseDto.code);
      if (existing) {
        if (!existing.isDeleted) {
          throw new ConflictException(`Course with code ${updateCourseDto.code} already exists`);
        } else {
          // It exists but is deleted. Rename it to free up the code for this update.
          existing.code = `${existing.code}_deleted_${Date.now()}`;
          await this.courseRepository.save(existing);
        }
      }
    }

    if (updateCourseDto.instructorId) {
      const instructor = await this.userRepository.findById(updateCourseDto.instructorId);
      if (!instructor || instructor.userType !== Role.STAFF) {
        throw new NotFoundException(`Staff with ID ${updateCourseDto.instructorId} not found`);
      }
      course.instructor = instructor;
    }

    if (updateCourseDto.adminId) {
      const admin = await this.userRepository.findById(updateCourseDto.adminId);
      if (!admin || admin.userType !== Role.ADMIN) {
        throw new NotFoundException(`Admin with ID ${updateCourseDto.adminId} not found`);
      }
      course.admin = admin;
    }

    Object.assign(course, updateCourseDto);
    return this.courseRepository.save(course);
  }

  async remove(id: number, isHard: boolean = false): Promise<void> {
    const course = await this.courseRepository.findOne({ where: { courseId: id } });
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    if (isHard) {
      await this.courseRepository.delete(id);
    } else {
      if (course.isDeleted) return; // Already soft-deleted
      course.isDeleted = true;
      course.code = `${course.code}_deleted_${Date.now()}`;
      await this.courseRepository.save(course);
    }
  }

  async removeByCode(code: string, isHard: boolean = false): Promise<void> {
    const course = await this.courseRepository.findByCodeAll(code);
    if (!course) {
      throw new NotFoundException(`Course with code ${code} not found`);
    }

    if (isHard) {
      await this.courseRepository.delete(course.courseId);
    } else {
      if (course.isDeleted) return; // Already soft-deleted
      course.isDeleted = true;
      course.code = `${course.code}_deleted_${Date.now()}`;
      await this.courseRepository.save(course);
    }
  }

  async enrollStudent(
    courseId: number, 
    studentId: number, 
    user: UserAccount,
    section?: string,
    lecture?: string
  ): Promise<CourseEnrollment> {
    console.log(`[Enrollment] Attempting to enroll student ${studentId} into course ${courseId} (by user ${user.userAccountId})`);
    
    const course = await this.courseRepository.findOne({
      where: { courseId, isDeleted: false },
      relations: ['instructor'],
    });
    if (!course) {
      console.error(`[Enrollment Failed] Course ${courseId} not found or deleted`);
      throw new NotFoundException(`Course Validation Failed: No active course found with ID ${courseId}.`);
    }

    // Permission check: Admin or the course's Instructor
    if (user.userType === Role.STAFF && course.instructor.userAccountId !== user.userAccountId) {
      console.warn(`[Enrollment Forbidden] Staff ${user.userAccountId} tried to enroll student into course ${courseId} taught by ${course.instructor.userAccountId}`);
      throw new ForbiddenException(`Access Denied: Instructors can only enroll students in courses they teach. Course '${course.name}' is managed by another instructor.`);
    }

    const student = await this.userRepository.findById(studentId);
    if (!student || student.userType !== Role.STUDENT) {
      console.error(`[Enrollment Failed] Student ${studentId} not found or not a student`);
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    const existingEnrollment = await this.enrollmentRepository.findOne({
      where: { courseId, studentId }
    });

    if (existingEnrollment) {
      console.warn(`[Enrollment Conflict] Student ${studentId} is already enrolled in course ${courseId}`);
      throw new ConflictException('Student already enrolled in this course');
    }

    const enrollment = this.enrollmentRepository.create({
      courseId,
      studentId,
      section,
      lecture,
    });

    const saved = await this.enrollmentRepository.save(enrollment);
    console.log(`[Enrollment Success] Student ${studentId} enrolled in course ${courseId}. Enrollment ID: ${saved.enrollmentId}`);
    return saved;
  }

  async getEnrolledStudents(courseId: number, user: UserAccount): Promise<CourseEnrollment[]> {
    const course = await this.courseRepository.findOne({
      where: { courseId, isDeleted: false },
      relations: ['instructor', 'enrollments', 'enrollments.student'],
    });
    if (!course) {
      throw new NotFoundException(`Course Validation Failed: No active course found with ID ${courseId}.`);
    }

    // Permission check: Admin or the course's Instructor
    if (user.userType === Role.STAFF && course.instructor.userAccountId !== user.userAccountId) {
      throw new ForbiddenException(`Access Denied: You can only view enrollment lists for your own assigned courses.`);
    }

    return course.enrollments || [];
  }

  async getUniqueSectionsAndLectures(courseId: number): Promise<{ sections: string[], lectures: string[] }> {
    const enrollments = await this.enrollmentRepository.find({
      where: { courseId },
      select: ['section', 'lecture'],
    });

    const sections = [...new Set(enrollments.map(e => e.section).filter(Boolean))].sort();
    const lectures = [...new Set(enrollments.map(e => e.lecture).filter(Boolean))].sort();

    return { sections, lectures };
  }
}
