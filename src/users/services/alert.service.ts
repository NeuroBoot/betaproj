import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from '../entities/alert.entity';
import { UserAccount } from '../entities/user.entity';

@Injectable()
export class AlertService {
  constructor(
    @InjectRepository(Alert)
    private alertRepo: Repository<Alert>,
  ) {}

  async findAll(user: UserAccount): Promise<Alert[]> {
    return this.alertRepo.find({
      where: { user: { userAccountId: user.userAccountId } },
      order: { createdAt: 'DESC' },
    });
  }

  async clearAll(user: UserAccount): Promise<void> {
    await this.alertRepo.delete({ user: { userAccountId: user.userAccountId } });
  }

  async remove(id: number, user: UserAccount): Promise<void> {
    const alert = await this.alertRepo.findOne({
      where: { id, user: { userAccountId: user.userAccountId } },
    });
    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }
    await this.alertRepo.remove(alert);
  }

  async create(user: UserAccount, title: string, message: string, type: string = 'info'): Promise<Alert> {
    const alert = this.alertRepo.create({
      user,
      title,
      message,
      type,
    });
    return this.alertRepo.save(alert);
  }
}
