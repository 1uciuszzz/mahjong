import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma.service";

@Injectable()
export class ExpendituresService {
  constructor(private readonly prisma: PrismaService) {}

  getRoom = async (roomId: string) => {
    const room = await this.prisma.room.findUnique({
      where: {
        id: roomId,
      },
      include: {
        users: true,
      },
    });
    return room;
  };

  async createExpenditure(
    roomId: string,
    payerId: string,
    payeeId: string,
    amount: number,
  ) {
    return await this.prisma.expenditure.create({
      data: {
        amount,
        payeeId,
        payerId,
        roomId,
      },
    });
  }
}
