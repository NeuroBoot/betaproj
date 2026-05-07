import { Injectable, BadGatewayException, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProcessUploadDto } from './dto/process-upload.dto';
import { ProcessFrameDto } from './dto/process-frame.dto';
import { AiRecognitionResultDto, MatchStatus, Model1ResponseDto } from './dto/ai-recognition-result.dto';
import { AttendanceService } from '../attendance/services/attendance.service';
import { UserRepository } from '../users/repositories/user.repository';

@Injectable()
export class VisionService {
  private readonly aiServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly attendanceService: AttendanceService,
    private readonly userRepo: UserRepository,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL', 'http://localhost:8000');
  }

  /**
   * Model 1: Registers student face embeddings by processing multiple images.
   */
  async registerStudent(dto: ProcessUploadDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/upload`, {
          images_base64: dto.imagesBase64,
          student_id: dto.studentId,
          name: dto.name,
        })
      );

      const aiResponse: Model1ResponseDto = response.data;

      // Validate AI Response
      if (!aiResponse.embedding) {
        throw new BadGatewayException('AI service failed to generate embedding');
      }

      // Update student in database
      const studentIdNum = parseInt(dto.studentId);
      const student = await this.userRepo.findById(studentIdNum);
      if (!student) {
        throw new NotFoundException(`Student with ID ${dto.studentId} not found`);
      }

      student.faceEmbedding = aiResponse.embedding;
      student.embeddingVersion = aiResponse.versionOfModel;
      student.embeddingCreatedAt = new Date(aiResponse.dateCreated);
      await this.userRepo.save(student);

      return {
        status: 'SUCCESS',
        message: 'Student face embeddings registered successfully',
        data: {
          studentId: dto.studentId,
          name: dto.name,
          version: aiResponse.versionOfModel,
          createdAt: aiResponse.dateCreated,
          aiStatus: aiResponse.status
        }
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('AI service unreachable or returned an error: ' + error.message);
    }
  }

  /**
   * Model 2: Processes a single camera frame for recognition and marks attendance if enrolled.
   */
  async processAttendanceFrame(dto: ProcessFrameDto) {
    let aiResponse: AiRecognitionResultDto;
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/recognize`, {
          image_base64: dto.imageBase64,
        })
      );
      aiResponse = response.data;
    } catch (error) {
      throw new BadGatewayException('AI service unreachable: ' + error.message);
    }

    // Manual validation of AI response
    const resultDto = plainToInstance(AiRecognitionResultDto, aiResponse);
    const errors = await validate(resultDto);
    if (errors.length > 0) {
      throw new BadGatewayException('AI service returned invalid payload structure');
    }

    if (resultDto.matchStatus === MatchStatus.NO_FACE_DETECTED) {
      return {
        status: 'NO_FACE',
        message: 'No face detected in the frame',
        matchStatus: MatchStatus.NO_FACE_DETECTED,
      };
    }

    if (resultDto.matchStatus === MatchStatus.NO_MATCH) {
      return {
        status: 'NO_MATCH',
        message: 'No matching student found for this face',
        matchStatus: MatchStatus.NO_MATCH,
        confidence: resultDto.confidenceScore
      };
    }

    // If MATCH, record attendance
    try {
      const result = await this.attendanceService.recordAiAttendance({
        studentId: parseInt(resultDto.studentId),
        courseId: dto.courseId,
        sessionType: dto.sessionType,
        sessionNumber: dto.sessionNumber,
        room: dto.room,
        confidenceScore: resultDto.confidenceScore,
        matchStatus: resultDto.matchStatus,
        sessionId: dto.sessionId,
      });

      return {
        status: result.status, // RECORDED | ALREADY_RECORDED
        message: result.status === 'RECORDED' ? 'Attendance marked successfully' : 'Attendance already marked for today',
        student: {
          id: resultDto.studentId,
          name: resultDto.name,
          match: resultDto.match,
          confidence: resultDto.confidenceScore
        },
        session: {
          courseId: dto.courseId,
          type: dto.sessionType,
          number: dto.sessionNumber,
          room: dto.room
        },
        aiModel: {
          version: resultDto.versionOfModel,
          matchStatus: resultDto.matchStatus
        },
        record: result.record
      };
    } catch (error) {
      return {
        status: 'ERROR',
        message: error.message,
        student: {
          id: resultDto.studentId,
          name: resultDto.name
        }
      };
    }
  }
}
