import { Controller, Get, Delete, Put, Post, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserAccount } from '../entities/user.entity';
import { AlertService } from '../services/alert.service';
import { Role } from '../../common/enums/role.enum';
import { BatchAlertDto } from '../dto/batch-alert.dto';

@ApiTags('Alerts')
@ApiBearerAuth('JWT-auth')
@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertController {
  constructor(private readonly alertService: AlertService) {}
  
  @Get()
  @ApiOperation({ summary: 'Get all user alerts' })
  async findAll(@CurrentUser() user: UserAccount) {
    return this.alertService.findAll(user);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear all alerts' })
  async clearAll(@CurrentUser() user: UserAccount) {
    await this.alertService.clearAll(user);
    return { success: true, message: 'All alerts cleared successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete specific alert' })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: UserAccount) {
    await this.alertService.remove(id, user);
    return { success: true, message: `Alert ${id} deleted successfully` };
  }

  @Post('check-low-attendance/:courseId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Trigger low attendance check for a course' })
  @ApiQuery({ name: 'threshold', required: false })
  async checkLowAttendance(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Query('threshold', new DefaultValuePipe(75), ParseIntPipe) threshold: number
  ) {
    return this.alertService.checkLowAttendance(courseId, threshold);
  }

  @Get('report/:courseId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get low attendance report for a course' })
  @ApiQuery({ name: 'threshold', required: false })
  async getReport(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Query('threshold', new DefaultValuePipe(75), ParseIntPipe) threshold: number
  ) {
    return this.alertService.getLowAttendanceReport(courseId, threshold);
  }

  @Post('batch')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Send alerts to multiple users' })
  @ApiBody({ type: BatchAlertDto })
  async sendBatch(
    @Body() payload: BatchAlertDto
  ) {
    return this.alertService.sendBatchAlerts(
      payload.userIds,
      payload.message,
      payload.type,
      payload.title
    );
  }

  @Post('send/:userId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Send a targeted alert to a specific student' })
  async sendToUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() payload: { message: string, title?: string, type?: string, metadata?: any }
  ) {
    return this.alertService.sendAlert(
      userId,
      payload.message,
      payload.type || 'info',
      payload.title || 'Notification',
      payload.metadata
    );
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get alert settings' })
  async getSettings() {
    // These could be moved to a UserSettings entity if needed
    return {
      lowAttendanceWarnings: true,
      systemUpdates: true,
      technicalIssues: false
    };
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update alert settings' })
  async updateSettings(@Body() payload: any) {
    return { success: true, message: 'Settings updated successfully', data: payload };
  }
}

