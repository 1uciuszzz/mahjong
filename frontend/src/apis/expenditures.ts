import { http } from "../utils/http";

export type CreateExpenditurePayload = {
  /** 房间ID */
  roomId: string;
  /** 接收人ID */
  payeeId: string;
  /** 金额 */
  amount: number;
};

export const EXPENDITURES_API = {
  CREATE_EXPENDITURE: {
    key: "CREATE_EXPENDITURE",
    fn: (payload: CreateExpenditurePayload) =>
      http.post(`/expenditures`, payload),
  },
};
