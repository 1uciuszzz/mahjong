import { http } from "../utils/http";

export const EXPENDITURES_API = {
  CREATE_EXPENDITURE: {
    key: "CREATE_EXPENDITURE",
    fn: (roomId: string, payeeId: string, amount: number) =>
      http.post(`/expenditures/${roomId}/${payeeId}/${amount}`),
  },
};
