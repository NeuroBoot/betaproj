import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  ForbiddenException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';

import { AttendanceService } from '../services/attendance.service';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto';
import { BulkAttendanceDto } from '../dto/bulk-attendance.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserAccount } from '../../users/entities/user.entity';

import { Role } from '../../common/enums/role.enum';

@ApiTags('Attendance')
@ApiBearerAuth('JWT-auth')
@Controller('api/v1/attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {

  constructor(private service: AttendanceService) {}

  @Get()
  @ApiOperation({ summary: 'List attendance records with pagination and filters' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'section', required: false })
  @ApiQuery({ name: 'date', required: false })
  async findAll(
    @CurrentUser() user: UserAccount,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('courseId', new DefaultValuePipe(null), ParseIntPipe) courseId?: number,
    @Query('section', new DefaultValuePipe(null), ParseIntPipe) section?: number,
    @Query('date') date?: string,
  ) {
    if (page > 0 && limit > 0) {
      return this.service.findAllPaginated(page, limit, { courseId, section, date }, user);
    }
    return this.service.findAll(user, { courseId, section, date });
  }

  @Get('my')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get my attendance (Student only)' })
  @ApiQuery({ name: 'courseId', required: false })
  async getMyAttendance(
    @CurrentUser() user: UserAccount,
    @Query('courseId', new DefaultValuePipe(null), ParseIntPipe) courseId?: number,
  ) {
    return this.service.getStudentAttendance(user.userAccountId, courseId);
  }

  @Get('course/:courseId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get attendance by course' })
  @ApiQuery({ name: 'section', required: false })
  @ApiQuery({ name: 'date', required: false })
  async getByCourse(
    @CurrentUser() user: UserAccount,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Query('section', new DefaultValuePipe(null), ParseIntPipe) section?: number,
    @Query('date') date?: string,
  ) {
    if (user.userType === Role.STAFF) {
      const isAuthorized = await this.service.isStaffAuthorizedForCourse(user.userAccountId, courseId);
      if (!isAuthorized) {
        throw new ForbiddenException('You are not authorized to view attendance for this course');
      }
    }
    return this.service.getCourseAttendance(courseId, section, date);
  }

  @Get('student/:studentId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get attendance for specific student' })
  @ApiQuery({ name: 'courseId', required: false })
  async getStudentAttendanceById(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query('courseId', new DefaultValuePipe(null), ParseIntPipe) courseId?: number
  ) {
    return this.service.getStudentAttendance(studentId, courseId);
  }

  @Get('track/:studentId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get intelligent tracking and risk analysis for a student' })
  @ApiQuery({ name: 'courseId', required: true })
  async trackStudent(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query('courseId', ParseIntPipe) courseId: number
  ) {
    return this.service.getStudentTracking(studentId, courseId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Create/Bulk-save attendance record' })
  @ApiBody({ description: 'Can accept either a single CreateAttendanceDto or a BulkAttendanceDto' })
  create(@Body() dto: any, @CurrentUser() user: UserAccount) {
    // Determine if it is a bulk save operation
    if (dto.attendance && Array.isArray(dto.attendance)) {
      return this.service.saveBulk(dto as BulkAttendanceDto, user);
    }
    return this.service.create(dto as CreateAttendanceDto, user);
  }

  @Put(':recordId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Update attendance record' })
  async update(
    @Param('recordId', ParseIntPipe) recordId: number,
    @Body() dto: UpdateAttendanceDto,
    @CurrentUser() user: UserAccount,
  ) {
    return this.service.update(recordId, dto, user.userAccountId, user.userType);
  }

  @Delete(':recordId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete attendance record (Admin only)' })
  async delete(
    @Param('recordId', ParseIntPipe) recordId: number,
    @CurrentUser() user: UserAccount,
  ) {
    return this.service.delete(recordId, user.userType);
  }

  @Get('statistics')
  @Roles(Role.ADMIN, Role.STAFF, Role.STUDENT)
  @ApiOperation({ summary: 'Get attendance statistics' })
  @ApiQuery({ name: 'courseId', required: false })
  statistics(
    @CurrentUser() user: UserAccount,
    @Query('courseId', new DefaultValuePipe(null), ParseIntPipe) courseId?: number,
  ) {
    return this.service.statistics(user, courseId);
  }
}