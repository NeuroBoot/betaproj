import { Injectable, BadGatewayException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProcessUploadDto } from './dto/process-upload.dto';
import { ProcessFrameDto } from './dto/process-frame.dto';
import { AiRecognitionResultDto, MatchStatus } from './dto/ai-recognition-result.dto';
import { AttendanceService } from '../attendance/services/attendance.service';

@Injectable()
export class VisionService {
  private readonly aiServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly attendanceService: AttendanceService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL', 'http://localhost:8000');
  }

  async uploadEmbedding(dto: ProcessUploadDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/upload`, {
          image_base64: dto.imageBase64,
          student_id: dto.studentId,
          name: dto.name,
        })
      );

      return {
        aiStatus: 'EMBEDDING_STORED',
        studentId: dto.studentId,
        name: dto.name,
        ...response.data,
      };
    } catch (error) {
      throw new BadGatewayException('AI service unreachable or returned an error');
    }
  }

  async recognizeFace(dto: ProcessFrameDto) {
    let aiResponse;
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/recognize`, {
          image_base64: dto.imageBase64,
        })
      );
      aiResponse = response.data;
    } catch (error) {
      throw new BadGatewayException('AI service unreachable');
    }

    // Manual validation of AI response
    const resultDto = plainToInstance(AiRecognitionResultDto, aiResponse);
    const errors = await validate(resultDto);
    if (errors.length > 0) {
      throw new BadGatewayException('AI service returned invalid payload');
    }

    if (resultDto.matchStatus === MatchStatus.NO_FACE_DETECTED) {
      return {
        result: 'NO_FACE_DETECTED',
        matchStatus: MatchStatus.NO_FACE_DETECTED,
      };
    }

    const result = await this.attendanceService.recordAiAttendance({
      studentId: parseInt(resultDto.studentId),
      courseId: dto.courseId, 
      sessionId: dto.sessionId,
      confidenceScore: resultDto.match,
      matchStatus: resultDto.matchStatus,
    });

    return {
      result: result.status, // RECORDED | ALREADY_RECORDED
      studentId: resultDto.studentId,
      name: resultDto.name,
      sectionId: dto.sectionId,
      confidenceScore: resultDto.match,
      matchStatus: resultDto.matchStatus,
      record: result.record
    };
  }
}
