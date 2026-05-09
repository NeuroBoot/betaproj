import { Controller, Post, Body, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { VisionService } from './vision.service';
import { ProcessUploadDto } from './dto/process-upload.dto';
import { ProcessFrameDto } from './dto/process-frame.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserAccount } from '../users/entities/user.entity';

@ApiTags('Vision AI')
@ApiBearerAuth('JWT-auth')
@Controller('vision')
export class VisionController {
  constructor(private readonly visionService: VisionService) {}

  /**
   * Model 1: Register student face embeddings from multiple images
   * Supports batch upload of multiple images for better accuracy
   */
  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ 
    summary: 'Model 1: Register student face embeddings from multiple images',
    description: 'Upload multiple images of a student to create a robust face embedding for accurate recognition'
  })
  @ApiResponse({ status: 200, description: 'Face embeddings registered successfully' })
  @ApiResponse({ status: 400, description: 'No face detected in any image' })
  @ApiResponse({ status: 503, description: 'AI service not available' })
  async upload(@Body() dto: ProcessUploadDto, @CurrentUser() user: UserAccount) {
    console.log(`[Vision] User ${user.username} uploading ${dto.imagesBase64.length} images for student ${dto.studentId}`);
    return this.visionService.registerStudent(dto);
  }

  /**
   * Model 2: Process camera frame for recognition and automated attendance
   */
  @Post('recognize')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ 
    summary: 'Model 2: Process camera frame for recognition and automated attendance',
    description: 'Captures a single frame, detects face, matches with registered students, and automatically marks attendance'
  })
  @ApiResponse({ status: 200, description: 'Face processed successfully' })
  @ApiResponse({ status: 503, description: 'AI service not available' })
  async recognize(@Body() dto: ProcessFrameDto, @CurrentUser() user: UserAccount) {
    console.log(`[Vision] User ${user.username} processing recognition for course ${dto.courseId}`);
    return this.visionService.processAttendanceFrame(dto);
  }

  /**
   * Check AI service health
   */
  @Get('health')
  @ApiOperation({ summary: 'Check AI service health status' })
  async checkHealth() {
    return this.visionService.checkHealth();
  }

  /**
   * Check if student has embedding
   */
  @Get('embeddings/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Check if student has face embedding' })
  async getEmbedding(@Param('studentId') studentId: string) {
    return this.visionService.getEmbeddingStatus(studentId);
  }

  /**
   * Delete student embedding
   */
  @Delete('embeddings/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete student face embedding (Admin only)' })
  async deleteEmbedding(@Param('studentId') studentId: string) {
    return this.visionService.deleteEmbedding(studentId);
  }
}