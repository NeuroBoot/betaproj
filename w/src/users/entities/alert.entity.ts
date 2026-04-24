import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { UserAccount } from './user.entity';

@Entity('alerts')
@Index(['userId', 'isRead'])
export class Alert {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => UserAccount)
  @JoinColumn({ name: 'userId' })
  user: UserAccount;

  @Column({ default: 'Alert' })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ 
    type: 'varchar', 
    default: 'info' 
  })
  type: string; // info, danger, warning, low_attendance, reminder

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;
}