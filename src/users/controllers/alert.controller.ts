import { Controller, Get, Delete, Put, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserAccount } from '../entities/user.entity';
import { AlertService } from '../services/alert.service';

@ApiTags('Alerts')
@ApiBearerAuth('JWT-auth')
@Controller('api/v1/alerts')
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
