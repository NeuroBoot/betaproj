import { Injectable, BadGatewayException, NotFoundException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProcessUploadDto, StudentUploadItemDto, BulkProcessUploadDto } from './dto/bulk-process-upload.dto';
import { ProcessFrameDto } from './dto/process-frame.dto';
import { AiRecognitionResultDto, MatchStatus, Model1ResponseDto, BatchUploadResultDto } from './dto/ai-recognition-result.dto';
import { AttendanceService } from '../attendance/services/attendance.service';
import { UserRepository } from '../users/repositories/user.repository';

@Injectable()
export class VisionService {
  private readonly aiServiceUrl: string;
  private readonly logger = new Logger(VisionService.name);

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
  async registerStudent(dto: ProcessUploadDto): Promise<BatchUploadResultDto> {
    this.logger.log(`[Model 1] Registering student ${dto.studentId} - ${dto.name} with ${dto.imagesBase64.length} images`);

    // Validate images count
    if (dto.imagesBase64.length === 0) {
      throw new BadGatewayException('At least one image is required for registration');
    }

    try {
      // Check AI service health
      let healthCheck;
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${this.aiServiceUrl}/health`)
        );
        healthCheck = response;
      } catch (error) {
        healthCheck = null;
      }
      
      if (!healthCheck) {
        throw new BadGatewayException('AI service is not running. Please start the FastAPI server on port 8000');
      }

      // Send to AI service for batch processing
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/upload/batch`, {
          images_base64: dto.imagesBase64,
          student_id: dto.studentId,
          name: dto.name,
          confidence_threshold: dto.confidenceThreshold || 0.6,
        })
      );

      const aiResponse: Model1ResponseDto = response.data;

      // Validate AI Response
      if (!aiResponse.embedding && !aiResponse.embeddings) {
        throw new BadGatewayException('AI service failed to generate embedding');
      }

      // Check if any faces were detected
      if (aiResponse.facesDetected === 0) {
        return {
          studentId: dto.studentId,
          name: dto.name,
          totalImages: dto.imagesBase64.length,
          successfulImages: 0,
          failedImages: dto.imagesBase64.length,
          failedIndices: Array.from({ length: dto.imagesBase64.length }, (_, i) => i),
          status: 'FAILED',
          message: 'No faces detected in any of the uploaded images. Please provide clear face images.'
        };
      }

      // Update student in database with the aggregated embedding
      const studentIdNum = parseInt(dto.studentId);
      let student = await this.userRepo.findById(studentIdNum);
      
      // Fallback: search by username if ID search fails (handles ID mismatch)
      if (!student) {
        student = await this.userRepo.findByUsername(dto.name);
      }

      if (!student) {
        throw new NotFoundException(`Student with ID ${dto.studentId} or name ${dto.name} not found in database`);
      }

      student.faceEmbedding = typeof aiResponse.embedding === 'string' 
        ? aiResponse.embedding 
        : JSON.stringify(aiResponse.embedding);
      student.embeddingVersion = aiResponse.versionOfModel;
      student.embeddingCreatedAt = new Date(aiResponse.dateCreated);
      student.embeddingImagesCount = aiResponse.imagesProcessed;
      await this.userRepo.save(student);

      this.logger.log(`[Model 1] Successfully registered student ${dto.studentId} with ${aiResponse.facesDetected} faces detected from ${aiResponse.imagesProcessed} images`);

      return {
        studentId: dto.studentId,
        name: dto.name,
        totalImages: dto.imagesBase64.length,
        successfulImages: aiResponse.imagesProcessed,
        failedImages: dto.imagesBase64.length - aiResponse.imagesProcessed,
        failedIndices: [],
        status: 'SUCCESS',
        embedding: aiResponse.embedding,
        message: `Successfully registered ${aiResponse.facesDetected} faces from ${aiResponse.imagesProcessed} images`
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadGatewayException) throw error;
      this.logger.error(`[Model 1] Error registering student ${dto.studentId}: ${error.message}`);
      throw new BadGatewayException(`AI service error: ${error.message}`);
    }
  }

  /**
   * Bulk registers multiple students at once.
   */
  async registerMultipleStudents(dto: BulkProcessUploadDto): Promise<any[]> {
    this.logger.log(`[Vision] Bulk registering ${dto.students.length} students`);
    const results = [];

    for (const studentDto of dto.students) {
      try {
        const result = await this.registerStudent({
          studentId: studentDto.studentId,
          name: studentDto.name,
          imagesBase64: studentDto.imagesBase64,
          confidenceThreshold: dto.confidenceThreshold
        });
        results.push({ studentId: studentDto.studentId, success: true, detail: result });
      } catch (error) {
        this.logger.error(`[Vision] Failed to register student ${studentDto.studentId}: ${error.message}`);
        results.push({ 
          studentId: studentDto.studentId, 
          success: false, 
          error: error instanceof BadGatewayException ? 'AI Service Error' : error.message 
        });
      }
    }

    return results;
  }

  /**
   * Model 2: Processes a single camera frame for recognition and marks attendance if enrolled.
   */
 async processAttendanceFrame(dto: ProcessFrameDto) {
  this.logger.log(`[Model 2] Processing attendance for course ${dto.courseId}, session ${dto.sessionNumber}`);

  let aiResponse: Partial<AiRecognitionResultDto>[];
  const startTime = Date.now();
  
  try {
    // Check AI service health
    let healthCheck;
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/health`)
      );
      healthCheck = response;
    } catch (error) {
      healthCheck = null;
    }
    
    if (!healthCheck) {
      throw new BadGatewayException('AI service is not running. Please start the FastAPI server on port 8000');
    }

    const response = await firstValueFrom(
      this.httpService.post(`${this.aiServiceUrl}/recognize`, {
        image_base64: dto.imageBase64,
        confidence_threshold: dto.confidenceThreshold || 0.7,
      }, { timeout: 60000 })
    );

    aiResponse = Array.isArray(response.data) ? response.data : [response.data];
  } catch (error) {
    const aiErrorDetail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    this.logger.error(`[Model 2] AI service error: ${aiErrorDetail}`);
    throw new BadGatewayException(`AI service unreachable: ${aiErrorDetail}`);
  }

  // ─── STEP 1: VALIDATE ENTIRE INCOMING WRAPPER RESPONSE ───
  if (!aiResponse || !Array.isArray(aiResponse)) {
    this.logger.error(`[Model 2] Invalid AI response wrapper: ${JSON.stringify(aiResponse)}`);
    throw new BadGatewayException(
      `AI Response Error: The vision service returned an incompatible payload structure or failed to communicate.`
    );
  }

  const finalResults = [];

  // ─── STEP 2: MULTI-FACE ARRAYS PROCESSING LOOP ───
  for (const face of aiResponse) {
    let rawMatch = face['match'] ?? face['similarity'] ?? face['confidenceScore'] ?? face['confidence'] ?? 0;
    let sanitizedMatch = (typeof rawMatch === 'number' && !isNaN(rawMatch)) ? rawMatch : parseFloat(String(rawMatch));
    if (isNaN(sanitizedMatch)) sanitizedMatch = 0;
    sanitizedMatch = Math.max(0, Math.min(1, sanitizedMatch));

    const resultDto = plainToInstance(AiRecognitionResultDto, {
      ...face,
      match: sanitizedMatch,
      confidenceScore: sanitizedMatch, 
    });

    const errors = await validate(resultDto);
    if (errors.length > 0) {
      this.logger.error(`[Model 2] Invalid face element skipped: ${JSON.stringify(errors)}`);
      continue; 
    }

    // Handle No Face Detected Case
    if (resultDto.matchStatus === MatchStatus.NO_FACE_DETECTED) {
      finalResults.push({
        status: 'NO_FACE_DETECTED',
        message: 'No face detected in the frame.',
        matchStatus: MatchStatus.NO_FACE_DETECTED,
        confidence: sanitizedMatch,
      });
      continue;
    }

    // Handle Unknown Individual Case
    if (resultDto.matchStatus === MatchStatus.NO_MATCH) {
      finalResults.push({
        status: 'NO_MATCH',
        message: `Unknown individual. Confidence: ${(sanitizedMatch * 100).toFixed(1)}%`,
        matchStatus: MatchStatus.NO_MATCH,
        confidence: sanitizedMatch, 
      });
      continue;
    }

    // Handle Valid Match Cases
    if (resultDto.matchStatus === MatchStatus.MATCH) {
      try {
        const studentIdNum = parseInt(resultDto.studentId);
        const student = await this.userRepo.findById(studentIdNum);
        
        if (!student) {
          finalResults.push({
            status: 'NOT_REGISTERED',
            message: `Student ID ${resultDto.studentId} not found in DB.`,
            student: { id: resultDto.studentId, name: resultDto.name },
          });
          continue;
        }

        const currentExecutionDelta = Date.now() - startTime;

        const result = await this.attendanceService.recordAiAttendance({
          studentId: studentIdNum,
          courseId: dto.courseId,
          sessionType: dto.sessionType,
          sessionNumber: dto.sessionNumber,
          room: dto.room || 'AI Vision',
          confidenceScore: sanitizedMatch, 
          matchStatus: resultDto.matchStatus,
          sessionId: dto.sessionId,
          processingTimeMs: currentExecutionDelta,
        });

        this.logger.log(`[Model 2] Successfully processed attendance: ${result.status} for student ${resultDto.studentId}`);

        finalResults.push({
          status: result.status.toUpperCase(),
          message: result.status === 'RECORDED' 
            ? `✅ Attendance marked successfully for ${resultDto.name}`
            : `⚠️ Attendance already marked for ${resultDto.name} today`,
          student: { 
            id: resultDto.studentId, 
            fullName: student.fullName || resultDto.name,
            confidence: sanitizedMatch 
          },
          record: result.record
        });
      } catch (error) {
        this.logger.error(`[Model 2] Error during ID verification process.for ID ${resultDto.studentId}: ${error.message}`);
        finalResults.push({ 
          status: 'ERROR', 
          message: error.message, 
          studentId: resultDto.studentId 
        });
      }
    }
  }

  const trueTotalProcessingTime = Date.now() - startTime;

  return {
    processedFacesCount: finalResults.length,
    processingTimeMs: trueTotalProcessingTime, 
    data: finalResults, 
  };
}


  /**
   * Check if AI service is healthy
   */
  async checkHealth(): Promise<{ status: string; embeddingsCount: number; service: string }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/health`)
      );
      return response.data;
    } catch (error) {
      throw new BadGatewayException('AI service is not responding');
    }
  }

  /**
   * Get embedding status for a student
   */
  async getEmbeddingStatus(studentId: string): Promise<{ exists: boolean; studentId: string; version?: string; createdAt?: Date }> {
    try {
      const student = await this.userRepo.findById(parseInt(studentId));
      if (!student) {
        throw new NotFoundException(`Student with ID ${studentId} not found`);
      }
      
      return {
        exists: !!student.faceEmbedding,
        studentId,
        version: student.embeddingVersion,
        createdAt: student.embeddingCreatedAt
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      return { exists: false, studentId };
    }
  }

  /**
   * Delete student embedding
   */
  async deleteEmbedding(studentId: string): Promise<{ success: boolean; message: string }> {
    try {
      const student = await this.userRepo.findById(parseInt(studentId));
      if (!student) {
        throw new NotFoundException(`Student with ID ${studentId} not found`);
      }
      
      student.faceEmbedding = null;
      student.embeddingVersion = null;
      student.embeddingCreatedAt = null;
      student.embeddingImagesCount = null;
      await this.userRepo.save(student);
      
      // Also delete from AI service (don't wait for response)
      try {
        await firstValueFrom(
          this.httpService.delete(`${this.aiServiceUrl}/embeddings/${studentId}`)
        );
      } catch (error) {
        this.logger.warn(`Failed to delete embedding from AI service: ${error.message}`);
      }
      
      return {
        success: true,
        message: `Embedding for student ${studentId} deleted successfully`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete embedding: ${error.message}`
      };
    }
  }
}
