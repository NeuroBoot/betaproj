import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { UserAccount } from './user.entity';

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  message: string;

  @Column({ default: 'info' }) // info, danger, warning
  type: string;

  @Column({ default: false })
  isRead: boolean;

  @ManyToOne(() => UserAccount)
  user: UserAccount;

  @CreateDateColumn()
  createdAt: Date;
}
