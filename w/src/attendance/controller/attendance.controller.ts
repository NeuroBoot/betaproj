import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
  ForbiddenException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AttendanceService } from '../services/attendance.service';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Attendance')
@ApiBearerAuth('JWT-auth')
@Controller('api/v1/attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'List all attendance (Admin/Staff only)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'section', required: false })
  @ApiQuery({ name: 'date', required: false })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('courseId', new DefaultValuePipe(null), ParseIntPipe) courseId?: number,
    @Query('section', new DefaultValuePipe(null), ParseIntPipe) section?: number,
    @Query('date') date?: string,
    @Req() req?: any
  ) {
    if (req.user.role === Role.STAFF) {
      return this.service.findByStaff(req.user.userId, page, limit, courseId, section, date);
    }
    return this.service.findAll(page, limit, courseId, section, date);
  }

  @Get('my')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get my attendance (Student only)' })
  @ApiQuery({ name: 'courseId', required: false })
  async getMyAttendance(
    @Query('courseId', new DefaultValuePipe(null), ParseIntPipe) courseId?: number,
    @Req() req?: any
  ) {
    return this.service.getStudentAttendance(req.user.userId, courseId);
  }

  @Get('course/:courseId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get attendance by course' })
  @ApiQuery({ name: 'section', required: false })
  @ApiQuery({ name: 'date', required: false })
  async getByCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Query('section', new DefaultValuePipe(null), ParseIntPipe) section?: number,
    @Query('date') date?: string,
    @Req() req?: any
  ) {
    if (req.user.role === Role.STAFF) {
      const isAuthorized = await this.service.isStaffAuthorizedForCourse(req.user.userId, courseId);
      if (!isAuthorized) {
        throw new ForbiddenException('You are not authorized to view attendance for this course');
      }
    }
    return this.service.getCourseAttendance(courseId, section, date);
  }

  @Get('statistics')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get attendance statistics' })
  @ApiQuery({ name: 'courseId', required: false })
  async getStatistics(
    @Query('courseId', new DefaultValuePipe(null), ParseIntPipe) courseId?: number,
    @Req() req?: any
  ) {
    if (req.user.role === Role.STAFF && courseId) {
      const isAuthorized = await this.service.isStaffAuthorizedForCourse(req.user.userId, courseId);
      if (!isAuthorized) {
        throw new ForbiddenException('You are not authorized to view statistics for this course');
      }
    }
    return this.service.getStatistics(courseId);
  }

  @Get('student/:studentId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get attendance for specific student' })
  async getStudentAttendanceById(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query('courseId', new DefaultValuePipe(null), ParseIntPipe) courseId?: number
  ) {
    return this.service.getStudentAttendance(studentId, courseId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Create attendance record' })
  async create(@Body() dto: CreateAttendanceDto, @Req() req: any) {
    if (req.user.role === Role.STAFF) {
      const isAuthorized = await this.service.isStaffAuthorizedForCourse(req.user.userId, dto.courseId);
      if (!isAuthorized) {
        throw new ForbiddenException('You are not authorized to mark attendance for this course');
      }
      dto.staffId = req.user.userId;
    }
    return this.service.create(dto);
  }

  @Put(':recordId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Update attendance record' })
  async update(
    @Param('recordId', ParseIntPipe) recordId: number,
    @Body() dto: UpdateAttendanceDto,
    @Req() req: any
  ) {
    return this.service.update(recordId, dto, req.user.userId, req.user.role);
  }

  @Delete(':recordId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete attendance record (Admin only)' })
  async delete(
    @Param('recordId', ParseIntPipe) recordId: number,
    @Req() req: any
  ) {
    return this.service.delete(recordId, req.user.userId, req.user.role);
  }
}