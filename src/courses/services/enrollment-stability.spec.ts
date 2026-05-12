import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from './courses.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Course } from '../entities/course.entity';
import { CourseEnrollment } from '../entities/course-enrollment.entity';
import { UserAccount } from '../../users/entities/user.entity';
import { CourseRepository } from '../repositories/course.repository';
import { UserRepository } from '../../users/repositories/user.repository';
import { Role } from '../../common/enums/role.enum';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('CoursesService Enrollment Stability', () => {
  let service: CoursesService;
  let courseRepo: any;
  let userRepo: any;
  let enrollmentRepo: any;

  beforeEach(async () => {
    courseRepo = {
      findOne: jest.fn(),
    };
    userRepo = {
      findById: jest.fn(),
    };
    enrollmentRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: CourseRepository, useValue: courseRepo },
        { provide: UserRepository, useValue: userRepo },
        { provide: getRepositoryToken(CourseEnrollment), useValue: enrollmentRepo },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
  });

  it('should successfully enroll a student', async () => {
    const mockCourse = { courseId: 1, name: 'Test Course', instructor: { userAccountId: 2 }, isDeleted: false };
    const mockStudent = { userAccountId: 3, userType: Role.STUDENT };
    const adminUser = { userAccountId: 1, userType: Role.ADMIN } as UserAccount;

    courseRepo.findOne.mockResolvedValue(mockCourse);
    userRepo.findById.mockResolvedValue(mockStudent);
    enrollmentRepo.findOne.mockResolvedValue(null);
    enrollmentRepo.create.mockReturnValue({ courseId: 1, studentId: 3 });
    enrollmentRepo.save.mockResolvedValue({ enrollmentId: 1, courseId: 1, studentId: 3 });

    const result = await service.enrollStudent(1, 3, adminUser);
    expect(result).toBeDefined();
    expect(enrollmentRepo.save).toHaveBeenCalled();
  });

  it('should throw ConflictException if student already enrolled', async () => {
    const mockCourse = { courseId: 1, name: 'Test Course', instructor: { userAccountId: 2 }, isDeleted: false };
    const mockStudent = { userAccountId: 3, userType: Role.STUDENT };
    const adminUser = { userAccountId: 1, userType: Role.ADMIN } as UserAccount;

    courseRepo.findOne.mockResolvedValue(mockCourse);
    userRepo.findById.mockResolvedValue(mockStudent);
    enrollmentRepo.findOne.mockResolvedValue({ enrollmentId: 1 });

    await expect(service.enrollStudent(1, 3, adminUser)).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException if course does not exist', async () => {
    courseRepo.findOne.mockResolvedValue(null);
    const adminUser = { userAccountId: 1, userType: Role.ADMIN } as UserAccount;

    await expect(service.enrollStudent(99, 3, adminUser)).rejects.toThrow(NotFoundException);
  });
});
