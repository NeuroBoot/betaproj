import { Test, TestingModule } from '@nestjs/testing';
import { VisionService } from './vision.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AttendanceService } from '../attendance/services/attendance.service';
import { UserRepository } from '../users/repositories/user.repository';
import { of, throwError } from 'rxjs';
import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { MatchStatus } from './dto/ai-recognition-result.dto';

describe('VisionService (Updated)', () => {
  let service: VisionService;
  let httpService: any;
  let attendanceService: any;
  let userRepo: any;

  beforeEach(async () => {
    httpService = {
      post: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    };
    attendanceService = {
      recordAiAttendance: jest.fn(),
    };
    userRepo = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisionService,
        { provide: HttpService, useValue: httpService },
        { provide: AttendanceService, useValue: attendanceService },
        { provide: UserRepository, useValue: userRepo },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://ai-service') },
        },
      ],
    }).compile();

    service = module.get<VisionService>(VisionService);
  });

  describe('processAttendanceFrame (Response Structure Verification)', () => {
    const mockDto = {
      imageBase64: 'frame1',
      courseId: 101,
      sessionType: 'LECTURE' as const,
      sessionNumber: '1',
      sectionId: 'S1',
      sessionId: 'sess_1',
      room: 'R1'
    };

    it('should include matched, studentId, and confidenceScore at top level for success', async () => {
      const aiResponse = {
        data: {
          matchStatus: MatchStatus.MATCH,
          studentId: '123',
          name: 'Ziad',
          match: 0.95,
          confidenceScore: 0.95,
          versionOfModel: 'v1.0',
          embedding: 'vec123',
          status: 'success'
        }
      };
      httpService.get.mockReturnValue(of({ data: { status: 'ok' } }));
      httpService.post.mockReturnValue(of(aiResponse));
      userRepo.findById.mockResolvedValue({ userAccountId: 123, username: 'ziad' });
      attendanceService.recordAiAttendance.mockResolvedValue({
        status: 'RECORDED',
        record: { recordId: 1 }
      });

      const result = await service.processAttendanceFrame(mockDto);
      
      expect(result.matched).toBe(true);
      expect(result.studentId).toBe('123');
      expect(result.confidenceScore).toBe(0.95);
      expect(result.status).toBe('RECORDED');
    });

    it('should include matched=false and studentId=null for NO_MATCH', async () => {
      const aiResponse = {
        data: {
          matchStatus: MatchStatus.NO_MATCH,
          studentId: '0',
          name: 'N/A',
          match: 0.1,
          confidenceScore: 0.1,
          versionOfModel: 'v1.0',
          embedding: '',
          status: 'success'
        }
      };
      httpService.get.mockReturnValue(of({ data: { status: 'ok' } }));
      httpService.post.mockReturnValue(of(aiResponse));

      const result = await service.processAttendanceFrame(mockDto);
      
      expect(result.matched).toBe(false);
      expect(result.studentId).toBeNull();
      expect(result.status).toBe('NO_MATCH');
      expect(result.confidence).toBe(0.1);
    });

    it('should handle NaN similarity by clamping to 0', async () => {
        const aiResponse = {
          data: {
            matchStatus: MatchStatus.NO_MATCH,
            studentId: '0',
            name: 'N/A',
            match: NaN,
            confidenceScore: NaN,
            versionOfModel: 'v1.0',
            embedding: '',
            status: 'success'
          }
        };
        httpService.get.mockReturnValue(of({ data: { status: 'ok' } }));
        httpService.post.mockReturnValue(of(aiResponse));
  
        const result = await service.processAttendanceFrame(mockDto);
        
        expect(result.matched).toBe(false);
        expect(result.confidence).toBe(0);
        expect(result.confidenceScore).toBeUndefined(); // It's NO_MATCH branch, check what's returned
      });
  });

  describe('registerMultipleStudents (Batch Verification)', () => {
    it('should return results for each student in bulk upload', async () => {
        const bulkDto = {
            students: [
                { studentId: '1', name: 'S1', imagesBase64: ['i1'] },
                { studentId: '2', name: 'S2', imagesBase64: ['i2'] }
            ]
        };

        const aiResponse = {
            data: {
              embedding: [0.1],
              versionOfModel: 'v1.0',
              dateCreated: '2024-05-07T10:00:00Z',
              status: 'success',
              facesDetected: 1,
              imagesProcessed: 1
            }
          };

        httpService.get.mockReturnValue(of({ data: { status: 'ok' } }));
        httpService.post.mockReturnValue(of(aiResponse));
        userRepo.findById.mockResolvedValue({ userAccountId: 1 });
        userRepo.save.mockResolvedValue({});

        const result = await service.registerMultipleStudents(bulkDto);
        
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
        expect(result[0].success).toBe(true);
        expect(result[1].success).toBe(true);
    });
  });
});
