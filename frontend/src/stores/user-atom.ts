import { atom } from "jotai";

export type UserInfo = {
  id: string;
  username: string;
  name: string;
};

export const userAtom = atom<UserInfo | null>(null);
