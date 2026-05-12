import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, CanActivate, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

// Core parts under test
import { VisionController } from './../src/vision/vision.controller';
import { VisionService } from './../src/vision/vision.service';

// Mocked dependencies
import { UserRepository } from './../src/users/repositories/user.repository';
import { AttendanceService } from './../src/attendance/services/attendance.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { MatchStatus } from './../src/vision/dto/ai-recognition-result.dto';
import { Role } from './../src/common/enums/role.enum';

describe('Vision Flow Isolated (E2E/Integration)', () => {
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

  const mockJwtGuard: CanActivate = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = { userId: mockUser.id, sub: mockUser.id, username: 'testuser', role: mockUser.role };
      return true;
    },
  };

  const mockRolesGuard: CanActivate = {
    canActivate: (context: ExecutionContext) => true,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [VisionController],
      providers: [
        VisionService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: UserRepository, useValue: mockUserRepo },
        { provide: AttendanceService, useValue: mockAttendanceService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://ai') } },
      ],
    })
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

  describe('POST /vision/upload (Model 1)', () => {
    it('should successfully register faces and return top-level status', async () => {
      mockHttpService.get.mockReturnValue(of({ data: { status: 'ok' } }));
      mockHttpService.post.mockReturnValue(of({
        data: {
          embedding: [0.1, 0.2],
          versionOfModel: 'Facenet512',
          dateCreated: new Date().toISOString(),
          status: 'success',
          facesDetected: 3,
          imagesProcessed: 3
        }
      }));

      mockUserRepo.findById.mockResolvedValue({ userAccountId: 101, username: 'student1' });
      mockUserRepo.save.mockResolvedValue({});

      const res = await request(app.getHttpServer())
        .post('/vision/upload')
        .send({
          students: [{
            studentId: '101',
            name: 'Test Student',
            imagesBase64: ['i1', 'i2', 'i3']
          }]
        });

      expect(res.status).toBe(201);
      expect(res.body[0].success).toBe(true);
      expect(res.body[0].detail.status).toBe('SUCCESS');
    });
  });

  describe('POST /vision/recognize (Model 2)', () => {
    it('should return a detailed response with top-level matched and confidenceScore', async () => {
        mockHttpService.get.mockReturnValue(of({ data: { status: 'ok' } }));
        mockHttpService.post.mockReturnValue(of({
          data: {
            matchStatus: MatchStatus.MATCH,
            studentId: '101',
            name: 'Test Student',
            match: 0.88,
            confidenceScore: 0.88,
            versionOfModel: 'Facenet512',
            status: 'success'
          }
        }));

        mockUserRepo.findById.mockResolvedValue({ userAccountId: 101, username: 'student1' });
        mockAttendanceService.recordAiAttendance.mockResolvedValue({
          status: 'RECORDED',
          record: { recordId: 99 }
        });

        const res = await request(app.getHttpServer())
          .post('/vision/recognize')
          .send({
            imageBase64: 'frame_data',
            courseId: 1,
            sectionId: '1',
            sessionId: 'sess_99',
            sessionType: 'LECTURE',
            sessionNumber: '1'
          });

        expect(res.status).toBe(201);
        expect(res.body.matched).toBe(true);
        expect(res.body.studentId).toBe('101');
        expect(res.body.confidenceScore).toBe(0.88);
        expect(res.body.status).toBe('RECORDED');
        expect(res.body.student.name).toBe('Test Student');
        expect(res.body.aiModel.version).toBe('Facenet512');
    });

    it('should handle NO_MATCH with matched=false and studentId=null', async () => {
        mockHttpService.get.mockReturnValue(of({ data: { status: 'ok' } }));
        mockHttpService.post.mockReturnValue(of({
          data: {
            matchStatus: MatchStatus.NO_MATCH,
            studentId: '0',
            name: 'N/A',
            match: 0.2,
            confidenceScore: 0.2,
            versionOfModel: 'Facenet512',
            status: 'success'
          }
        }));

        const res = await request(app.getHttpServer())
          .post('/vision/recognize')
          .send({
            imageBase64: 'frame_unknown',
            courseId: 1,
            sectionId: '1',
            sessionId: 'sess_100',
            sessionType: 'LECTURE',
            sessionNumber: '1'
          });

        expect(res.status).toBe(201);
        expect(res.body.matched).toBe(false);
        expect(res.body.studentId).toBeNull();
        expect(res.body.status).toBe('NO_MATCH');
    });
  });
});
