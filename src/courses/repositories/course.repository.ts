import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Course } from '../entities/course.entity';

/**
 * Data Access Layer for Course entity.
 */
@Injectable()
export class CourseRepository extends Repository<Course> {
  constructor(private dataSource: DataSource) {
    super(Course, dataSource.createEntityManager());
  }

  async findByCode(code: string): Promise<Course | null> {
    return this.findOne({ where: { code, isDeleted: false }, relations: ['instructor', 'admin'] });
  }

  async findById(id: number): Promise<Course | null> {
    return this.findOne({ where: { courseId: id, isDeleted: false }, relations: ['instructor', 'admin'] });
  }

  async findAllActive(): Promise<Course[]> {
    return this.find({ where: { isDeleted: false }, relations: ['instructor', 'admin'] });
  }

  async findByInstructor(instructorId: number): Promise<Course[]> {
    return this.find({ 
      where: { 
        instructor: { userAccountId: instructorId }, 
        isDeleted: false 
      }, 
      relations: ['instructor', 'admin'] 
    });
  }

  async findByStudent(studentId: number): Promise<Course[]> {
    return this.createQueryBuilder('course')
      .leftJoin('course.students', 'student')
      .leftJoinAndSelect('course.instructor', 'instructor')
      .leftJoinAndSelect('course.admin', 'admin')
      .where('student.userAccountId = :studentId', { studentId })
      .andWhere('course.isDeleted = :isDeleted', { isDeleted: false })
      .getMany();
  }
}
