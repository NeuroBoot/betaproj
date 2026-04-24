import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CourseRepository } from '../repositories/course.repository';
import { UserRepository } from '../../users/repositories/user.repository';
import { CreateCourseDto } from '../dto/create-course.dto';
import { UpdateCourseDto } from '../dto/update-course.dto';
import { Course } from '../entities/course.entity';
import { Role } from '../../common/enums/role.enum';
import { UserAccount } from '../../users/entities/user.entity';

@Injectable()
export class CoursesService {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async create(createCourseDto: CreateCourseDto, adminUser?: UserAccount): Promise<Course> {
    const existingCourse = await this.courseRepository.findByCode(createCourseDto.code);
    if (existingCourse) {
      throw new ConflictException(`Course with code ${createCourseDto.code} already exists`);
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

  async findAll(user: UserAccount): Promise<Course[]> {
    // Admin can see all courses
    if (user.userType === Role.ADMIN) {
      return this.courseRepository.findAllActive();
    }
    
    // Staff can see courses they teach
    if (user.userType === Role.STAFF) {
      return this.courseRepository.findByInstructor(user.userAccountId);
    }
    
    // Students can see courses they are enrolled in
    if (user.userType === Role.STUDENT) {
      return this.courseRepository.findByStudent(user.userAccountId);
    }
    
    return this.courseRepository.findAllActive();
  }

  async findOne(id: number, user: UserAccount): Promise<Course> {
    const course = await this.courseRepository.findOne({
      where: { courseId: id, isDeleted: false },
      relations: ['instructor', 'admin', 'students'],
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    // Permission check
    if (user.userType === Role.STAFF && course.instructor?.userAccountId !== user.userAccountId) {
      throw new ForbiddenException('You can only access your own courses');
    }

    if (user.userType === Role.STUDENT) {
      const isEnrolled = course.students?.some(s => s.userAccountId === user.userAccountId) || false;
      if (!isEnrolled) {
        throw new ForbiddenException('You are not enrolled in this course');
      }
    }

    return course;
  }

  async update(id: number, updateCourseDto: UpdateCourseDto): Promise<Course> {
    const course = await this.courseRepository.findById(id);
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    if (updateCourseDto.code && updateCourseDto.code !== course.code) {
      const existing = await this.courseRepository.findByCode(updateCourseDto.code);
      if (existing) {
        throw new ConflictException(`Course with code ${updateCourseDto.code} already exists`);
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

  async remove(id: number): Promise<void> {
    const course = await this.courseRepository.findById(id);
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }
    course.isDeleted = true;
    await this.courseRepository.save(course);
  }
  
  async restore(id: number): Promise<Course> {
    const course = await this.courseRepository.findOne({
      where: { courseId: id, isDeleted: true },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }
    course.isDeleted = false;
    return this.courseRepository.save(course);
  }

  async enrollStudent(courseId: number, studentId: number): Promise<Course> {
    const course = await this.courseRepository.findOne({
      where: { courseId, isDeleted: false },
      relations: ['students'],
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    const student = await this.userRepository.findById(studentId);
    if (!student || student.userType !== Role.STUDENT) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    if (course.students?.some(s => s.userAccountId === studentId)) {
      throw new ConflictException('Student already enrolled in this course');
    }

    if (!course.students) {
      course.students = [];
    }
    course.students.push(student);
    return this.courseRepository.save(course);
  }

  async getEnrolledStudents(courseId: number): Promise<UserAccount[]> {
    const course = await this.courseRepository.findOne({
      where: { courseId, isDeleted: false },
      relations: ['students'],
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }
    return course.students || [];
  }

  async unenrollStudent(courseId: number, studentId: number): Promise<Course> {
    const course = await this.courseRepository.findOne({
      where: { courseId, isDeleted: false },
      relations: ['students'],
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    const student = await this.userRepository.findById(studentId);
    if (!student || student.userType !== Role.STUDENT) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    const isEnrolled = course.students?.some(s => s.userAccountId === studentId);
    if (!isEnrolled) {
      throw new ConflictException('Student is not enrolled in this course');
    }

    course.students = course.students.filter(s => s.userAccountId !== studentId);
    return this.courseRepository.save(course);
  }

  async getCoursesByInstructor(instructorId: number): Promise<Course[]> {
    const instructor = await this.userRepository.findById(instructorId);
    if (!instructor || instructor.userType !== Role.STAFF) {
      throw new NotFoundException(`Staff with ID ${instructorId} not found`);
    }
    return this.courseRepository.findByInstructor(instructorId);
  }

  async getCoursesByStudent(studentId: number): Promise<Course[]> {
    const student = await this.userRepository.findById(studentId);
    if (!student || student.userType !== Role.STUDENT) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }
    return this.courseRepository.findByStudent(studentId);
  }

  async searchCourses(searchTerm: string): Promise<Course[]> {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.courseRepository.findAllActive();
    }
    return this.courseRepository.searchCourses(searchTerm);
  }

  async getCourseWithFullDetails(courseId: number): Promise<Course> {
    const course = await this.courseRepository.findOne({
      where: { courseId, isDeleted: false },
      relations: ['instructor', 'admin', 'students', 'attendanceRecords'],
    });
    
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }
    
    return course;
  }

  async getCourseStatistics(courseId: number): Promise<{
    totalStudents: number;
    totalAttendanceRecords: number;
    courseName: string;
    courseCode: string;
  }> {
    const course = await this.courseRepository.findOne({
      where: { courseId, isDeleted: false },
      relations: ['students', 'attendanceRecords'],
    });
    
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }
    
    return {
      courseName: course.name,
      courseCode: course.code,
      totalStudents: course.students?.length || 0,
      totalAttendanceRecords: course.attendanceRecords?.length || 0,
    };
  }

  async isStudentEnrolled(courseId: number, studentId: number): Promise<boolean> {
    const course = await this.courseRepository.findOne({
      where: { courseId, isDeleted: false },
      relations: ['students'],
    });
    
    if (!course) {
      return false;
    }
    
    return course.students?.some(s => s.userAccountId === studentId) || false;
  }

  async getCoursesWithPagination(
    user: UserAccount,
    page: number = 1,
    limit: number = 10
  ): Promise<{ data: Course[]; total: number; page: number; limit: number; totalPages: number }> {
    let courses: Course[];
    let total: number;
    
    if (user.userType === Role.ADMIN) {
      const result = await this.courseRepository.findActiveCoursesWithPagination(page, limit);
      courses = result.data;
      total = result.total;
    } else if (user.userType === Role.STAFF) {
      courses = await this.courseRepository.findByInstructor(user.userAccountId);
      total = courses.length;
      // Manual pagination for staff
      const skip = (page - 1) * limit;
      courses = courses.slice(skip, skip + limit);
    } else {
      courses = await this.courseRepository.findByStudent(user.userAccountId);
      total = courses.length;
      // Manual pagination for student
      const skip = (page - 1) * limit;
      courses = courses.slice(skip, skip + limit);
    }
    
    return {
      data: courses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}