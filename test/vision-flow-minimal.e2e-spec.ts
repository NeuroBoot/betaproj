import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, CanActivate, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

// Modules
import { VisionModule } from './../src/vision/vision.module';

// Repositories
import { UserRepository } from './../src/users/repositories/user.repository';
import { AttendanceService } from './../src/attendance/services/attendance.service';

import { MatchStatus } from './../src/vision/dto/ai-recognition-result.dto';
import { Role } from './../src/common/enums/role.enum';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';

describe('Vision Flow Minimal (E2E)', () => {
  let app: INestApplication;
  let mockUser = { id: 101, role: Role.STUDENT };

  const mockHttpService = {
    get: jest.fn(),
    post: jest.fn(),
  };

  const mockUserRepo = {
    findById: jest.fn(),
    save: jest.fn(),
  };

  const mockAttendanceService = {
    recordAiAttendance: jest.fn(),
  };

  // Mock Guards
  const mockJwtGuard: CanActivate = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = { userId: mockUser.id, sub: mockUser.id, username: 'testuser', role: mockUser.role };
      return true;
    },
  };

  const mockRolesGuard: CanActivate = {
    canActivate: (context: ExecutionContext) => true, // Bypass for simplicity
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [VisionModule],
    })
      .overrideProvider(HttpService).useValue(mockHttpService)
      .overrideProvider(UserRepository).useValue(mockUserRepo)
      .overrideProvider(AttendanceService).useValue(mockAttendanceService)
      .overrideProvider(ConfigService).useValue({ get: jest.fn().mockReturnValue('http://ai') })
      .overrideGuard(JwtAuthGuard).useValue(mockJwtGuard)
      .overrideGuard(RolesGuard).useValue(mockRolesGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Student Face Registration (/vision/upload)', () => {
    it('should allow Role.STUDENT to upload their face and return detailed response', async () => {
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

      mockUserRepo.findById.mockResolvedValue({ userAccountId: 101, username: 'student1' });
      mockUserRepo.save.mockResolvedValue({});

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
      expect(res.body[0].detail.status).toBe('SUCCESS');
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

        mockUserRepo.findById.mockResolvedValue({ userAccountId: 101, username: 'student1' });
        mockAttendanceService.recordAiAttendance.mockResolvedValue({
          status: 'RECORDED',
          record: { recordId: 1 }
        });

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
