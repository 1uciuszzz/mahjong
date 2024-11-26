import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SignInDto } from "./dto/sign-in.dto";
import { Auth } from "./decorators/auth.decorator";
import { AuthType } from "./enums/auth-type.enum";
import { User } from "src/shared/decorators/user.decorator";
import { TokenPayload } from "src/shared/entities/token-payload.entity";
import { SignUpDto } from "./dto/sign-up.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("sign-in")
  @Auth(AuthType.None)
  async signIn(@Body() payload: SignInDto) {
    const user = await this.authService.getUserByUsername(payload.username);
    if (!user) {
      throw new ForbiddenException("用户不存在");
    }
    const isMatch = await this.authService.checkPassword(
      payload.password,
      user.password,
    );
    if (!isMatch) {
      throw new ForbiddenException(`身份验证失败`);
    }
    const token = await this.authService.generateToken(user.id, user.username);
    return { token };
  }

  @Post("sign-up")
  @Auth(AuthType.None)
  async signUp(@Body() payload: SignUpDto) {
    const isExist = await this.authService.getUserByUsername(payload.username);
    if (isExist) {
      throw new ForbiddenException("用户名已存在");
    }
    const user = await this.authService.signUp(
      payload.username,
      payload.password,
      payload.name,
    );
    const token = await this.authService.generateToken(user.id, user.username);
    return { token };
  }

  @Get()
  @Auth(AuthType.Bearer)
  getUserInfo(@User() user: TokenPayload) {
    return this.authService.getUserInfo(user.sub);
  }
}
