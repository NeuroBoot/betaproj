import { Controller, Get, Delete, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserAccount } from '../entities/user.entity';

@ApiTags('Alerts')
@ApiBearerAuth('JWT-auth')
@Controller('api/v1/alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertController {
  
  @Get()
  @ApiOperation({ summary: 'Get all user alerts' })
  async findAll(@CurrentUser() user: UserAccount) {
    // Mock for now, linked to logic
    return [
      { id: 1, title: 'Low Attendance', message: 'You missed 3 sections in Math', type: 'danger', createdAt: new Date() },
      { id: 2, title: 'System Update', message: 'The server will be down at midnight', type: 'info', createdAt: new Date() }
    ];
  }

  @Delete()
  @ApiOperation({ summary: 'Clear all alerts' })
  async clearAll() {
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete specific alert' })
  async remove(@Param('id') id: string) {
    return { success: true };
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get alert settings' })
  async getSettings() {
    return {
      lowAttendanceWarnings: true,
      systemUpdates: true,
      technicalIssues: false
    };
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update alert settings' })
  async updateSettings(@Body() payload: any) {
    return { success: true, data: payload };
  }
}
