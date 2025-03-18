import { ApiProperty } from "@nestjs/swagger";

export class ChangeUserInfoDto {
  @ApiProperty()
  name: string;
}
