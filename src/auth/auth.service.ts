import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterRequest } from './dto/register.dto';
import { hash, verify } from 'argon2';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt.interface';
import { LoginRequest } from './dto/login.dto';
import { Response } from 'express';

@Injectable()
export class AuthService {
    private readonly JWT_SECRET: string;
    private readonly JWT_ACCESS_TOKEN_TTL;
    private readonly JWT_REFRESH_TOKEN_TTL;

    constructor(
        private readonly prismaService: PrismaService,
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService,
    ) {
        this.JWT_SECRET = configService.getOrThrow<string>("JWT_SECRET");
        this.JWT_ACCESS_TOKEN_TTL = configService.getOrThrow("JWT_ACCESS_TOKEN_TTL");
        this.JWT_REFRESH_TOKEN_TTL = configService.getOrThrow("JWT_REFRESH_TOKEN_TTL");
    }

    async register(dto: RegisterRequest) {
        const { name, email, password } = dto;

        const existUser = await this.prismaService.user.findUnique({
            where: {
                email,
            },
        });

        if (existUser) {
            throw new ConflictException('Почта есть')
        }

        const user = await this.prismaService.user.create({
            data: {
                name,
                email, 
                password: await hash(password),
            }
        })

        return this.generateToken(user.id);
    }



    async login(dto: LoginRequest) {
        const { email, password } = dto

        const user = await this.prismaService.user.findUnique({
            where: {
                email,
            },
            select: {
                id: true,
                password: true,
            }
        });

        if(!user) {
            throw new NotFoundException('Пользователь не найден')
        }

        const isValidPassword = await verify(user.password, password)

        if (!isValidPassword) {
            throw new NotFoundException('Пользователь не найден')
        }

        return this.generateToken(user.id)
    }




    private generateToken(id: string) {
        const payload:JwtPayload = { id };

        const accesToken = this.jwtService.sign(payload, {
            expiresIn: this.JWT_ACCESS_TOKEN_TTL,
        })

        const refreshToken = this.jwtService.sign(payload, {
            expiresIn: this.JWT_REFRESH_TOKEN_TTL,
        })

        return {
            accesToken, 
            refreshToken
        }
    }


    private setCookie(res: Response) {

    }
}
