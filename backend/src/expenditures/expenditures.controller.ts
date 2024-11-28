import {
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Post,
} from "@nestjs/common";
import { ExpendituresService } from "./expenditures.service";
import { Auth } from "src/auth/decorators/auth.decorator";
import { AuthType } from "src/auth/enums/auth-type.enum";
import { User } from "src/shared/decorators/user.decorator";
import { TokenPayload } from "src/shared/entities/token-payload.entity";
import { CreateExpenditureDto } from "./dto/create-expenditure.dto";

@Controller("expenditures")
export class ExpendituresController {
  constructor(private readonly expendituresService: ExpendituresService) {}

  @Post()
  @Auth(AuthType.Bearer)
  async createExpenditure(
    @User() user: TokenPayload,
    @Body() payload: CreateExpenditureDto,
  ) {
    if (payload.amount <= 0) {
      throw new ForbiddenException("账单金额不能小于1");
    }
    const room = await this.expendituresService.getRoom(payload.roomId);
    if (!room) {
      throw new NotFoundException("房间不存在");
    }
    if (!room.active) {
      throw new ForbiddenException("房间已关闭");
    }
    const joined = room.users.find((item) => item.id === user.sub);
    if (!joined) {
      throw new ForbiddenException("用户不在房间中");
    }
    return await this.expendituresService.createExpenditure(
      payload.roomId,
      user.sub,
      payload.payeeId,
      payload.amount,
    );
  }
}
