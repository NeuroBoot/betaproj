import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VisionService } from './vision.service';
import { VisionController } from './vision.controller';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    AttendanceModule,
  ],
  controllers: [VisionController],
  providers: [VisionService],
})
export class VisionModule {}
