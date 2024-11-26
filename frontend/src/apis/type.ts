import { AxiosResponse } from "axios";

export interface PaginationPayload {
  page: number;
  size: number;
}

export type Res<T> = Promise<AxiosResponse<T>>;
