import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { RoomsService } from "./rooms.service";
import { Auth } from "src/auth/decorators/auth.decorator";
import { AuthType } from "src/auth/enums/auth-type.enum";
import { User } from "src/shared/decorators/user.decorator";
import { TokenPayload } from "src/shared/entities/token-payload.entity";
import { CreateRoomDto } from "./dto/create-room.dto";
import { JoinRoomDto } from "./dto/join-room.dto";

@Controller("rooms")
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @Auth(AuthType.Bearer)
  async createRoom(@User() user: TokenPayload, @Body() payload: CreateRoomDto) {
    const room = await this.roomsService.createRoom(
      payload.name,
      payload.password,
    );
    await this.roomsService.joinRoom(user.sub, room.id);
    return room;
  }

  @Get(":roomId")
  @Auth(AuthType.Bearer)
  async getRoomDetails(
    @User() user: TokenPayload,
    @Param("roomId") roomId: string,
  ) {
    const roomWithUsers = await this.roomsService.getRoomWithUsers(roomId);
    if (!roomWithUsers.users.find((item) => item.id === user.sub)) {
      throw new ForbiddenException(`您不在该房间中`);
    }
    const expenditureStats =
      await this.roomsService.getUsersExpenditureStats(roomId);
    const expenditures = await this.roomsService.getExpenditures(roomId);
    return { roomWithUsers, expenditureStats, expenditures };
  }

  @Post("join/:roomId")
  @Auth(AuthType.Bearer)
  async joinRoom(
    @User() user: TokenPayload,
    @Param("roomId") roomId: string,
    @Body() payload: JoinRoomDto,
  ) {
    const room = await this.roomsService.getRoom(roomId);
    if (!room.active) {
      throw new ForbiddenException(`该房间已关闭`);
    }
    if (room.password !== payload.password) {
      throw new ForbiddenException(`房间密码不正确`);
    }
    return await this.roomsService.joinRoom(user.sub, roomId);
  }

  @Get()
  @Auth(AuthType.Bearer)
  async getRooms(
    @User() user: TokenPayload,
    @Query("page") page: number,
    @Query("size") size: number,
  ) {
    page = page || 1;
    size = size || 10;
    const skip = (page - 1) * size;
    const rooms = await this.roomsService.getRooms(user.sub, skip, size);
    const total = await this.roomsService.getCount(user.sub);
    return { total, rooms };
  }

  @Patch(":roomId/close")
  @Auth(AuthType.Bearer)
  async closeRoom(@User() user: TokenPayload, @Param("roomId") roomId: string) {
    return await this.roomsService.closeRoom(user.sub, roomId);
  }
}
