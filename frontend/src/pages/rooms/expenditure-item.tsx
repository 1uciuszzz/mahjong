import { Expenditure } from "@/apis/rooms";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import UserName from "@/components/user-name";
import { formatDate } from "@/utils/format-date";
import { CircleCheckBig } from "lucide-react";

type ExpenditureItemProps = {
  expenditure: Expenditure;
};

const ExpenditureItem = ({ expenditure }: ExpenditureItemProps) => {
  return (
    <Alert>
      <CircleCheckBig className="w-4 h-4" color="green" />
      <AlertTitle className="flex gap-1">
        <UserName>{expenditure.payer.name}</UserName>向
        <UserName>{expenditure.payee.name}</UserName>
        <span>支付了</span>
        <span className="font-mono font-bold">{expenditure.amount}</span>
      </AlertTitle>
      <AlertDescription>
        <p className="text-xs text-gray-500">
          {formatDate(expenditure.createdAt)}
        </p>
      </AlertDescription>
    </Alert>
  );
};

export default ExpenditureItem;
