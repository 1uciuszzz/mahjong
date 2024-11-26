import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { APP_GUARD } from "@nestjs/core";
import { TokenGuard } from "./auth/guards/token.guard";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import JwtConfig from "./auth/config/jwt.config";
import { RoomsModule } from "./rooms/rooms.module";
import { ExpendituresModule } from "./expenditures/expenditures.module";

@Module({
  imports: [
    AuthModule,
    ConfigModule.forFeature(JwtConfig),
    JwtModule.registerAsync(JwtConfig.asProvider()),
    RoomsModule,
    ExpendituresModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: TokenGuard }],
})
export class AppModule {}
