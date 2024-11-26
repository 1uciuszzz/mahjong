import { http } from "../utils/http";
import { Room } from "../pages/rooms/page";
import { PaginationPayload, Res } from "./type";
import { UserInfo } from "@/stores/user-atom";

export type User = {
  id: string;
  name: string;
};

export type UserStats = {
  id: string;
  name: string;
  amount: number;
};

export type Expenditure = {
  id: string;
  payerId: string;
  payeeId: string;
  amount: number;
  createdAt: string;
  roomId: string;
  payee: UserInfo;
  payer: UserInfo;
};

type RoomDetailResponse = {
  roomWithUsers: Room & {
    password: string;
    userBalances: Record<
      string,
      {
        balance: number;
        expense: number;
        income: number;
        userId: string;
      }
    > | null;
  };
  expenditureStats: Record<
    string,
    {
      balance: number;
      expense: number;
      income: number;
      userId: string;
    }
  > | null;
  expenditures: Expenditure[];
};

type CreateRoomResponse = {
  id: string;
  name: string;
  createdAt: string;
};

type GetRoomsResponse = {
  rooms: Room[];
  total: number;
};

export type CreateRoomPayload = {
  name: string;
  password: string;
};

export const ROOMS_API = {
  CREATE_ROOM: {
    key: "CREATE_ROOM",
    fn: (payload: CreateRoomPayload): Res<CreateRoomResponse> =>
      http.post(`/rooms`, payload),
  },
  GET_ROOMS: {
    key: "GET_ROOMS",
    fn: (payload: PaginationPayload): Res<GetRoomsResponse> =>
      http.get(`/rooms`, { params: payload }),
  },
  GET_USERS: {
    key: "GET_USERS",
    fn: (roomId: string): Res<User[]> => http.get(`/rooms/${roomId}/users`),
  },
  ROOM_DETAIL: {
    key: "ROOM_DETAIL",
    fn: (id: string): Res<RoomDetailResponse> => http.get(`/rooms/${id}`),
  },
  JOIN_ROOM: {
    key: "JOIN_ROOM",
    fn: (
      id: string,
      password: string
    ): Res<
      Omit<Room, "users"> & {
        password: string;
        userBalances: null;
      }
    > => http.post(`/rooms/join/${id}`, { password }),
  },
  CLOSE_ROOM: {
    key: "CLOSE_ROOM",
    fn: (id: string) => http.patch(`/rooms/${id}/close`),
  },
};
