import { ApiProperty } from "@nestjs/swagger";
import { SignInDto } from "./sign-in.dto";

export class SignUpDto extends SignInDto {
  @ApiProperty()
  name: string;
}
