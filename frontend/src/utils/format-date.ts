import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export const formatDate = (date: string) => {
  return format(date, `yyyy/MM/dd hh:mm:ss`, { locale: zhCN });
};
