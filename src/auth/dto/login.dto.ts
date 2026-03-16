import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for user login request.
 * Encapsulates input validation for the login endpoint.
 */
export class LoginDto {
  // Required username field for user identification.
  @ApiProperty({ example: 'ziad_taha', description: 'The username of the user' })
  @IsString()
  @IsNotEmpty()
  username: string;

  // Required password field with a minimum character constraint.
  @ApiProperty({ example: 'password123', description: 'The password of the user (min 6 chars)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
