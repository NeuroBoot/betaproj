import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Role } from '../../common/enums/role.enum';

/**
 * Database entity representing a user account in the system.
 * Maps to the 'UserAccount' table in MySQL.
 */
@Entity('UserAccount')
export class UserAccount {
  // Unique primary identifier for each user.
  @PrimaryGeneratedColumn()
  userAccountId: number;

  // Unique username for authentication purposes.
  @Column({ unique: true })
  username: string;

  // Securely hashed password string.
  @Column()
  password: string;

  // The classification of the user (Admin, Staff, or Student).
  @Column({
    type: 'enum',
    enum: Role,
    default: Role.STUDENT,
  })
  userType: Role;

  // Flag for soft-deletion of the user record.
  @Column({ default: false })
  isDeleted: boolean;

  // Automatically recorded timestamp of account creation.
  @CreateDateColumn()
  createdAt: Date;

  // Automatically updated timestamp of the last account modification.
  @UpdateDateColumn()
  updatedAt: Date;
}
