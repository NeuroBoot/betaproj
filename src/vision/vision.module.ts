import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VisionService } from './vision.service';
import { VisionController } from './vision.controller';
import { AttendanceModule } from '../attendance/attendance.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // Increased timeout for batch uploads (30 seconds)
      maxRedirects: 5,
    }),
    AttendanceModule,
    UsersModule,
  ],
  controllers: [VisionController],
  providers: [VisionService],
  exports: [VisionService],
})
export class VisionModule {}