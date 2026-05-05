import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from '../repository/attendance.repository';
import { UserRepository } from '../../users/repositories/user.repository';
import { CourseRepository } from '../../courses/repositories/course.repository';
import { AlertService } from '../../users/services/alert.service';
import { Role } from '../../common/enums/role.enum';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let attendanceRepo: any;
  let userRepo: any;
  let courseRepo: any;

  beforeEach(async () => {
    attendanceRepo = {
      create: jest.fn(),
      saveMany: jest.fn(),
      findAll: jest.fn(),
      findAllWithFilters: jest.fn(),
      findByStudent: jest.fn(),
      findByStaff: jest.fn(),
      findByFilter: jest.fn(),
      statistics: jest.fn(),
      getDetailedStatistics: jest.fn(),
      statisticsByStaff: jest.fn(),
      statisticsByStudent: jest.fn(),
      findOneById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    userRepo = {
      findById: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    courseRepo = {
      findOne: jest.fn(),
      findById: jest.fn(),
      findByInstructor: jest.fn(),
      getEnrolledStudents: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: AttendanceRepository, useValue: attendanceRepo },
        { provide: UserRepository, useValue: userRepo },
        { provide: CourseRepository, useValue: courseRepo },
        { provide: AlertService, useValue: { checkStudentLowAttendance: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const mockUser: any = { userAccountId: 10, userType: Role.STAFF, username: 'staff1' };
    const mockDto: any = {
      studentId: 1,
      courseId: 2,
      staffId: 10,
      attendanceStatusId: 1,
      recordDate: '2024-01-01',
      room: 'R1',
      sessionType: 'LECTURE',
      sectionNumber: 1
    };

    it('should throw NotFoundException if student does not exist', async () => {
      userRepo.findById.mockResolvedValue(null);
      await expect(service.create(mockDto, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if course does not exist', async () => {
      userRepo.findById.mockResolvedValue({ userAccountId: 1, userType: Role.STUDENT });
      courseRepo.findOne.mockResolvedValue(null);
      await expect(service.create(mockDto, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if staff records attendance for other course', async () => {
      userRepo.findById.mockResolvedValue({ userAccountId: 1, userType: Role.STUDENT });
      courseRepo.findOne.mockResolvedValue({ 
        courseId: 2, 
        instructor: { userAccountId: 20 },
        isDeleted: false 
      });
      await expect(service.create(mockDto, mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should create attendance record successfully', async () => {
      const student = { userAccountId: 1, userType: Role.STUDENT, username: 'stud1' };
      const course = { 
        courseId: 2, 
        name: 'Course 1',
        instructor: { userAccountId: 10 },
        enrollments: [{ studentId: 1 }],
        isDeleted: false 
      };
      
      userRepo.findById.mockResolvedValue(student);
      courseRepo.findOne.mockResolvedValue(course);
      attendanceRepo.create.mockResolvedValue({ recordId: 100 });

      const result = await service.create(mockDto, mockUser);
      expect(result).toBeDefined();
      expect(attendanceRepo.create).toHaveBeenCalled();
    });
  });
});
