import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@ivorian-realty/shared-lib';
import { AppError } from '../middleware/errorHandler';

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '24h';

export interface User {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'buyer' | 'seller' | 'agent' | 'admin';
  phone?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: Omit<User, 'password'>;
  };
}

export class AuthService {
  private async getUsersCollection() {
    const db = await getDatabase();
    return db.collection('users');
  }

  async register(userData: Omit<User, '_id' | 'createdAt' | 'updatedAt'>): Promise<AuthResponse> {
    try {
      const users = await this.getUsersCollection();
      // Check if user already exists
      const existingUser = await users.findOne({ email: userData.email });
      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      // Create user object
      const newUser: User = {
        ...userData,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insert user into database
      const result = await users.insertOne(newUser as any);
      const userId = result.insertedId.toString();

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId, 
          email: userData.email, 
          role: userData.role 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
      );

      // Return user data without password
      const { password, ...userWithoutPassword } = newUser;

      return {
        success: true,
        message: 'Registration successful',
        data: {
          token,
          user: {
            _id: userId,
            ...userWithoutPassword
          }
        }
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Registration failed', 500);
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const users = await this.getUsersCollection();
      // Find user by email
      const user = await users.findOne({ email });
      if (!user) {
        throw new AppError('Invalid email or password', 401);
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new AppError('Invalid email or password', 401);
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user._id.toString(), 
          email: user.email, 
          role: user.role 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
      );

      // Return user data without password
      return {
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            _id: user._id.toString(),
            firstName: user.firstName as string,
            lastName: user.lastName as string,
            email: user.email as string,
            role: user.role as User['role'],
            phone: user.phone as string | undefined,
            createdAt: user.createdAt as Date | undefined,
            updatedAt: user.updatedAt as Date | undefined
          }
        }
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Login failed', 500);
    }
  }

  async getCurrentUser(userId: string): Promise<Omit<User, 'password'>> {
    try {
      const users = await this.getUsersCollection();
      const user = await users.findOne({ _id: new ObjectId(userId) });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      return {
        _id: user._id.toString(),
        firstName: user.firstName as string,
        lastName: user.lastName as string,
        email: user.email as string,
        role: user.role as User['role'],
        phone: user.phone as string | undefined,
        createdAt: user.createdAt as Date | undefined,
        updatedAt: user.updatedAt as Date | undefined
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get user profile', 500);
    }
  }

  async updateProfile(userId: string, updateData: Partial<Omit<User, '_id' | 'password' | 'createdAt'>>): Promise<Omit<User, 'password'>> {
    try {
      const users = await this.getUsersCollection();
      const updateFields = {
        ...updateData,
        updatedAt: new Date()
      };

      const result = await users.updateOne(
        { _id: new ObjectId(userId) },
        { $set: updateFields }
      );

      if (result.matchedCount === 0) {
        throw new AppError('User not found', 404);
      }

      const updatedUser = await users.findOne({ _id: new ObjectId(userId) });
      if (!updatedUser) {
        throw new AppError('User not found', 404);
      }

      return {
        _id: updatedUser._id.toString(),
        firstName: updatedUser.firstName as string,
        lastName: updatedUser.lastName as string,
        email: updatedUser.email as string,
        role: updatedUser.role as User['role'],
        phone: updatedUser.phone as string | undefined,
        createdAt: updatedUser.createdAt as Date | undefined,
        updatedAt: updatedUser.updatedAt as Date | undefined
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update profile', 500);
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const users = await this.getUsersCollection();
      const user = await users.findOne({ _id: new ObjectId(userId) });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new AppError('Current password is incorrect', 400);
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await users.updateOne(
        { _id: new ObjectId(userId) },
        { 
          $set: { 
            password: hashedNewPassword,
            updatedAt: new Date()
          }
        }
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to change password', 500);
    }
  }
}
