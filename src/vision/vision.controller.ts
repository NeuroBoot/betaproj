import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VisionService } from './vision.service';
import { ProcessUploadDto } from './dto/process-upload.dto';
import { ProcessFrameDto } from './dto/process-frame.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Vision AI')
@ApiBearerAuth('JWT-auth')
@Controller('vision')
export class VisionController {
  constructor(private readonly visionService: VisionService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Model 1: Register student face embeddings from a batch of images' })
  async upload(@Body() dto: ProcessUploadDto) {
    return this.visionService.registerStudent(dto);
  }

  @Post('recognize')
  @ApiOperation({ summary: 'Model 2: Process camera frame for recognition and automated attendance' })
  async recognize(@Body() dto: ProcessFrameDto) {
    return this.visionService.processAttendanceFrame(dto);
  }
}
