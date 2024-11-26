import axios, { AxiosResponse } from "axios";
import { http } from "../utils/http";

export type SignInPayload = {
  username: string;
  password: string;
};

type SignInRes = {
  token: string;
};

type UserInfoResponse = {
  id: string;
  name: string;
  username: string;
};

export type SignUpPayload = SignInPayload & {
  name: string;
};

export const AUTH_API = {
  USER_INFO: {
    key: "USER_INFO",
    fn: (): Promise<AxiosResponse<UserInfoResponse>> => http.get(`/auth`),
  },
  SIGN_IN: {
    key: "SIGN_IN",
    fn: (payload: SignInPayload): Promise<AxiosResponse<SignInRes>> =>
      axios.post(`/api/auth/sign-in`, payload),
  },
  SIGN_UP: {
    key: "SIGN_UP",
    fn: (payload: SignUpPayload): Promise<AxiosResponse<SignInRes>> =>
      axios.post(`/api/auth/sign-up`, payload),
  },
};
