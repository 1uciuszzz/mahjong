import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "src/prisma.service";
import JwtConfig from "./config/jwt.config";
import { compare, genSalt, hash } from "bcrypt";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(JwtConfig.KEY)
    private readonly jwtConfig: ConfigType<typeof JwtConfig>,
  ) {}

  private async signToken<T>(userId: string, expiresIn: number, payload?: T) {
    return await this.jwtService.signAsync(
      {
        sub: userId,
        ...payload,
      },
      {
        secret: this.jwtConfig.secret,
        expiresIn,
      },
    );
  }

  getUserByUsername = async (username: string) => {
    const user = await this.prisma.user.findUnique({
      where: {
        username,
      },
    });
    return user;
  };

  hashPassword = async (password: string) => {
    const salt = await genSalt();
    const hashedPassword = await hash(password, salt);
    return hashedPassword;
  };

  signUp = async (username: string, password: string, name: string) => {
    const hashedPassword = await this.hashPassword(password);
    const user = await this.prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
      },
    });
    return user;
  };

  checkPassword = async (rawPassword: string, hashedPassword: string) => {
    const res = await compare(rawPassword, hashedPassword);
    return res;
  };

  generateToken = async (id: string, username: string) => {
    const token = await this.signToken<{ username: string }>(
      id,
      this.jwtConfig.accessTokenTtl,
      { username },
    );
    return `Bearer ${token}`;
  };

  getUserInfo = async (userId: string) => {
    const user = await this.prisma.user.findUnique({
      select: {
        id: true,
        name: true,
        username: true,
      },
      where: {
        id: userId,
      },
    });
    return user;
  };
}
