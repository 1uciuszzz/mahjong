import { ApiProperty } from "@nestjs/swagger";

export class JoinRoomDto {
  @ApiProperty()
  password: string;
}
