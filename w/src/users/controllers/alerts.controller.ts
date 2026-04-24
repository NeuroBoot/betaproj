import { Controller, Post, Get, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AlertsService } from '../services/alerts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Alerts')
@ApiBearerAuth('JWT-auth')
@Controller('api/v1/alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post('check-low-attendance')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Check and alert students with low attendance' })
  async checkLowAttendance(
    @Body() body: { courseId: number; threshold?: number }
  ) {
    const threshold = body.threshold || 75;
    return this.alertsService.checkLowAttendance(body.courseId, threshold);
  }

  @Post('send')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Send manual alert to a user' })
  async sendAlert(
    @Body() body: { userId: number; message: string; type?: string; title?: string }
  ) {
    return this.alertsService.sendAlert(body.userId, body.message, body.type, body.title);
  }

  @Post('send-batch')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Send batch alerts to multiple users (Admin only)' })
  async sendBatchAlerts(
    @Body() body: { userIds: number[]; message: string; type?: string; title?: string }
  ) {
    return this.alertsService.sendBatchAlerts(body.userIds, body.message, body.type, body.title);
  }

  @Get('my')
  @Roles(Role.STUDENT, Role.STAFF, Role.ADMIN)
  @ApiOperation({ summary: 'Get my alerts' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  async getMyAlerts(
    @CurrentUser() user: any,
    @Query('unreadOnly', new DefaultValuePipe(false)) unreadOnly: boolean
  ) {
    return this.alertsService.getUserAlerts(user.userId, unreadOnly === true );
  }

  @Post(':alertId/read')
  @Roles(Role.STUDENT, Role.STAFF, Role.ADMIN)
  @ApiOperation({ summary: 'Mark alert as read' })
  async markAsRead(
    @Param('alertId', ParseIntPipe) alertId: number,
    @CurrentUser() user: any
  ) {
    return this.alertsService.markAsRead(alertId, user.userId);
  }

  @Get('report/low-attendance/:courseId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get low attendance report' })
  @ApiQuery({ name: 'threshold', required: false, type: Number })
  async getLowAttendanceReport(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Query('threshold', new DefaultValuePipe(75), ParseIntPipe) threshold: number
  ) {
    return this.alertsService.getLowAttendanceReport(courseId, threshold);
  }
}