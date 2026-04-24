import { Injectable } from '@nestjs/common';
import { DataSource, Repository, UpdateResult } from 'typeorm';
import { Course } from '../entities/course.entity';
import { UserAccount } from '../../users/entities/user.entity';

/**
 * Data Access Layer for Course entity.
 */
@Injectable()
export class CourseRepository extends Repository<Course> {
  constructor(private dataSource: DataSource) {
    super(Course, dataSource.createEntityManager());
  }

  async findByCode(code: string): Promise<Course | null> {
    return this.findOne({ 
      where: { code, isDeleted: false }, 
      relations: ['instructor', 'admin', 'students'] 
    });
  }

  async findById(id: number): Promise<Course | null> {
    return this.findOne({ 
      where: { courseId: id, isDeleted: false }, 
      relations: ['instructor', 'admin', 'students'] 
    });
  }

  async findAllActive(): Promise<Course[]> {
    return this.find({ 
      where: { isDeleted: false }, 
      relations: ['instructor', 'admin', 'students'],
      order: { createdAt: 'DESC' }
    });
  }

  async findByInstructor(instructorId: number): Promise<Course[]> {
    return this.find({ 
      where: { 
        instructor: { userAccountId: instructorId }, 
        isDeleted: false 
      }, 
      relations: ['instructor', 'admin', 'students'],
      order: { name: 'ASC' }
    });
  }

  async findByStudent(studentId: number): Promise<Course[]> {
    return this.createQueryBuilder('course')
      .leftJoin('course.students', 'student')
      .leftJoinAndSelect('course.instructor', 'instructor')
      .leftJoinAndSelect('course.admin', 'admin')
      .where('student.userAccountId = :studentId', { studentId })
      .andWhere('course.isDeleted = :isDeleted', { isDeleted: false })
      .orderBy('course.name', 'ASC')
      .getMany();
  }

  async getEnrolledStudents(courseId: number): Promise<UserAccount[]> {
    const course = await this.findOne({
      where: { courseId, isDeleted: false },
      relations: ['students'],
    });
    
    if (!course) {
      return [];
    }
    
    return course.students || [];
  }

  async isStudentEnrolled(courseId: number, studentId: number): Promise<boolean> {
    const result = await this.createQueryBuilder('course')
      .leftJoin('course.students', 'student')
      .where('course.courseId = :courseId', { courseId })
      .andWhere('student.userAccountId = :studentId', { studentId })
      .andWhere('course.isDeleted = :isDeleted', { isDeleted: false })
      .getOne();
    
    return !!result;
  }

  async getCourseWithStudents(courseId: number): Promise<Course | null> {
    return this.findOne({
      where: { courseId, isDeleted: false },
      relations: ['students', 'instructor', 'admin'],
    });
  }

  async getCoursesByAdmin(adminId: number): Promise<Course[]> {
    return this.find({
      where: {
        admin: { userAccountId: adminId },
        isDeleted: false
      },
      relations: ['instructor', 'admin', 'students'],
      order: { createdAt: 'DESC' }
    });
  }

  async getCourseCountByInstructor(instructorId: number): Promise<number> {
    return this.count({
      where: {
        instructor: { userAccountId: instructorId },
        isDeleted: false
      }
    });
  }

  async getCourseCountByStudent(studentId: number): Promise<number> {
    return this.createQueryBuilder('course')
      .leftJoin('course.students', 'student')
      .where('student.userAccountId = :studentId', { studentId })
      .andWhere('course.isDeleted = :isDeleted', { isDeleted: false })
      .getCount();
  }

  // ✅ تصحيح دالة softDelete - تغيير نوع الإرجاع إلى Promise<UpdateResult>
  async softDeleteCourse(courseId: number): Promise<UpdateResult> {
    return this.update(courseId, { isDeleted: true });
  }

  // ✅ تصحيح دالة restore - تغيير نوع الإرجاع إلى Promise<UpdateResult>
  async restoreCourse(courseId: number): Promise<UpdateResult> {
    return this.update(courseId, { isDeleted: false });
  }

  // ✅ استخدام أسماء مختلفة لتجنب التعارض مع الدوال الأصلية
  async findActiveCoursesWithPagination(
    page: number = 1, 
    limit: number = 10
  ): Promise<{ data: Course[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    
    const [data, total] = await this.findAndCount({
      where: { isDeleted: false },
      relations: ['instructor', 'admin'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' }
    });
    
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async searchCourses(searchTerm: string): Promise<Course[]> {
    return this.createQueryBuilder('course')
      .leftJoinAndSelect('course.instructor', 'instructor')
      .leftJoinAndSelect('course.admin', 'admin')
      .where('course.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(
        '(course.name LIKE :search OR course.code LIKE :search OR course.description LIKE :search)',
        { search: `%${searchTerm}%` }
      )
      .orderBy('course.name', 'ASC')
      .getMany();
  }

  async bulkEnrollStudents(courseId: number, studentIds: number[]): Promise<void> {
    const course = await this.findOne({
      where: { courseId, isDeleted: false },
      relations: ['students'],
    });
    
    if (!course) {
      throw new Error('Course not found');
    }
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      for (const studentId of studentIds) {
        const isEnrolled = course.students?.some(s => s.userAccountId === studentId);
        if (!isEnrolled) {
          await queryRunner.manager
            .createQueryBuilder()
            .relation(Course, 'students')
            .of(course)
            .add(studentId);
        }
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async bulkUnenrollStudents(courseId: number, studentIds: number[]): Promise<void> {
    const course = await this.findOne({
      where: { courseId, isDeleted: false },
      relations: ['students'],
    });
    
    if (!course) {
      throw new Error('Course not found');
    }
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      for (const studentId of studentIds) {
        await queryRunner.manager
          .createQueryBuilder()
          .relation(Course, 'students')
          .of(course)
          .remove(studentId);
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}