import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma.service";

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRoom(roomId: string) {
    return await this.prisma.room.findUnique({
      where: {
        id: roomId,
      },
    });
  }

  async createRoom(roomName: string, password: string) {
    return await this.prisma.room.create({
      data: {
        name: roomName,
        password,
      },
    });
  }

  async isUserInRoom(userId: string, roomId: string) {
    return await this.prisma.user.findFirst({
      where: {
        id: userId,
        rooms: {
          some: {
            id: roomId,
          },
        },
      },
    });
  }

  async joinRoom(userId: string, roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { users: true },
    });

    if (room?.users.some((user) => user.id === userId)) {
      return room;
    }

    return await this.prisma.room.update({
      where: { id: roomId },
      data: {
        users: {
          connect: { id: userId },
        },
      },
    });
  }

  async checkRoomPasswrod(roomId: string, password: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room.password) {
      return true;
    }
    return password == room.password;
  }

  async getRoomWithUsers(roomId: string) {
    const roomWithUsers = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });
    return roomWithUsers;
  }

  async getRooms(userId: string, skip: number, take: number) {
    return await this.prisma.room.findMany({
      select: {
        id: true,
        active: true,
        closedAt: true,
        createdAt: true,
        name: true,
        users: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
      where: {
        users: {
          some: {
            id: userId,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take,
    });
  }

  async getUsersExpenditureStats(roomId: string) {
    const expenses = await this.prisma.expenditure.groupBy({
      by: ["payerId"],
      _sum: { amount: true },
      where: { roomId },
    });
    const incomes = await this.prisma.expenditure.groupBy({
      by: ["payeeId"],
      _sum: { amount: true },
      where: { roomId },
    });
    const balances: Record<
      string,
      { userId: string; income: number; expense: number; balance: number }
    > = {};

    expenses.forEach((expense) => {
      const { payerId, _sum } = expense;
      if (!balances[payerId]) {
        balances[payerId] = {
          userId: payerId,
          income: 0,
          expense: 0,
          balance: 0,
        };
      }
      balances[payerId].expense = _sum.amount || 0;
    });

    incomes.forEach((income) => {
      const { payeeId, _sum } = income;
      if (!balances[payeeId]) {
        balances[payeeId] = {
          userId: payeeId,
          income: 0,
          expense: 0,
          balance: 0,
        };
      }
      balances[payeeId].income = _sum.amount || 0;
    });
    Object.values(balances).forEach((balance) => {
      balance.balance = balance.income - balance.expense;
    });

    return balances;
  }

  async getExpenditures(roomId: string) {
    return await this.prisma.expenditure.findMany({
      take: 12,
      where: {
        roomId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        payee: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        payer: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });
  }

  async closeRoom(userId: string, roomId: string) {
    const balances = await this.getUsersExpenditureStats(roomId);

    if (!balances[userId]) {
      throw new ForbiddenException(`你不在此房间中,无法关闭该房间`);
    }

    const room = await this.prisma.room.update({
      where: { id: roomId },
      data: {
        active: false,
        closedAt: new Date(),
        userBalances: balances,
      },
    });

    await this.prisma.expenditure.deleteMany({
      where: { roomId },
    });

    return room;
  }

  getCount = async (userId: string) => {
    const count = await this.prisma.room.count({
      where: {
        users: {
          some: {
            id: userId,
          },
        },
      },
    });
    return count;
  };
}
