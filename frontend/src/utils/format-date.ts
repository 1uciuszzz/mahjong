import { format } from "date-fns";

export const formatDate = (date: string) => {
  return format(date, `yyyy/MM/dd hh:mm:ss`);
};
