import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, CanActivate, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { HttpService } from '@nestjs/axios';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { DataSource } from 'typeorm';

// Modules
import { VisionModule } from './../src/vision/vision.module';
import { AttendanceModule } from './../src/attendance/attendance.module';
import { UsersModule } from './../src/users/users.module';
import { AuthModule } from './../src/auth/auth.module';
import { CoursesModule } from './../src/courses/courses.module';

// Repositories
import { UserRepository } from './../src/users/repositories/user.repository';
import { AttendanceRepository } from './../src/attendance/repository/attendance.repository';
import { CourseRepository } from './../src/courses/repositories/course.repository';

// Entities
import { UserAccount } from './../src/users/entities/user.entity';
import { Attendance } from './../src/attendance/entities/attendance.entity';
import { Course } from './../src/courses/entities/course.entity';
import { Alert } from './../src/users/entities/alert.entity';
import { CourseEnrollment } from './../src/courses/entities/course-enrollment.entity';

import { MatchStatus } from './../src/vision/dto/ai-recognition-result.dto';
import { Role } from './../src/common/enums/role.enum';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';

describe('Vision Flow & Permissions (E2E)', () => {
  let app: INestApplication;
  let mockUser = { id: 101, role: Role.STUDENT };

  const mockHttpService = {
    get: jest.fn(),
    post: jest.fn(),
  };

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    findById: jest.fn(),
    findDuplicate: jest.fn(),
    create: jest.fn(),
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockRepo),
    createEntityManager: jest.fn().mockReturnValue({
        getRepository: jest.fn().mockReturnValue(mockRepo),
    }),
  };

  // Mock Guards to simulate logged in user
  const mockJwtGuard: CanActivate = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = { userId: mockUser.id, sub: mockUser.id, username: 'testuser', role: mockUser.role };
      return true;
    },
  };

  const mockRolesGuard: CanActivate = {
    canActivate: (context: ExecutionContext) => {
      // Roles guard usually checks metadata, for E2E simplicity we check req.user
      const req = context.switchToHttp().getRequest();
      return req.user.role === Role.STUDENT || req.user.role === Role.STAFF || req.user.role === Role.ADMIN;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AuthModule,
        UsersModule,
        CoursesModule,
        AttendanceModule,
        VisionModule,
      ],
    })
      .overrideProvider(DataSource).useValue(mockDataSource)
      .overrideProvider(HttpService).useValue(mockHttpService)
      .overrideProvider(UserRepository).useValue(mockRepo)
      .overrideProvider(AttendanceRepository).useValue(mockRepo)
      .overrideProvider(CourseRepository).useValue(mockRepo)
      .overrideProvider(getRepositoryToken(UserAccount)).useValue(mockRepo)
      .overrideProvider(getRepositoryToken(Attendance)).useValue(mockRepo)
      .overrideProvider(getRepositoryToken(Course)).useValue(mockRepo)
      .overrideProvider(getRepositoryToken(Alert)).useValue(mockRepo)
      .overrideProvider(getRepositoryToken(CourseEnrollment)).useValue(mockRepo)
      .overrideGuard(JwtAuthGuard).useValue(mockJwtGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Student Face Registration (/vision/upload)', () => {
    it('should allow Role.STUDENT to upload their face', async () => {
      mockUser.role = Role.STUDENT;
      
      mockHttpService.get.mockReturnValue(of({ data: { status: 'ok' } }));
      mockHttpService.post.mockReturnValue(of({
        data: {
          embedding: [0.1],
          versionOfModel: 'v1',
          dateCreated: new Date().toISOString(),
          status: 'success',
          facesDetected: 1,
          imagesProcessed: 1
        }
      }));

      mockRepo.findById.mockResolvedValue({ userAccountId: 101, username: 'student1' });
      mockRepo.save.mockResolvedValue({});

      const res = await request(app.getHttpServer())
        .post('/vision/upload')
        .send({
          students: [{
            studentId: '101',
            name: 'Student One',
            imagesBase64: ['img1']
          }]
        });

      expect(res.status).toBe(201);
      expect(res.body[0].success).toBe(true);
    });
  });

  describe('Detailed Response Recognition (/vision/recognize)', () => {
    it('should return the mandatory detailed response structure', async () => {
        mockHttpService.get.mockReturnValue(of({ data: { status: 'ok' } }));
        mockHttpService.post.mockReturnValue(of({
          data: {
            matchStatus: MatchStatus.MATCH,
            studentId: '101',
            name: 'Student One',
            match: 0.95,
            confidenceScore: 0.95,
            versionOfModel: 'v1',
            status: 'success'
          }
        }));

        mockRepo.findById.mockResolvedValue({ userAccountId: 101, username: 'student1' });
        mockRepo.findOne.mockResolvedValue({ 
            courseId: 1, 
            enrollments: [{ studentId: 101 }] 
        });
        mockRepo.findDuplicate.mockResolvedValue(null);
        mockRepo.create.mockReturnValue({ recordId: 1 });

        const res = await request(app.getHttpServer())
          .post('/vision/recognize')
          .send({
            imageBase64: 'frame1',
            courseId: 1,
            sectionId: '1',
            sessionId: 'sess1',
            sessionType: 'LECTURE',
            sessionNumber: '1'
          });

        expect(res.status).toBe(201);
        // Verify mandatory detailed fields
        expect(res.body).toHaveProperty('matched', true);
        expect(res.body).toHaveProperty('studentId', '101');
        expect(res.body).toHaveProperty('confidenceScore', 0.95);
        expect(res.body.student).toBeDefined();
        expect(res.body.session).toBeDefined();
        expect(res.body.aiModel).toBeDefined();
        expect(res.body.processingTimeMs).toBeDefined();
    });
  });
});
