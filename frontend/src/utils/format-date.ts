import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export const formatDate = (date: string) => {
  return format(date, `yyyy/MM/dd HH:mm:ss`, { locale: zhCN });
};
