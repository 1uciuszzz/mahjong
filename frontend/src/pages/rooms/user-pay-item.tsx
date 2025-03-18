import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserInfo } from "@/stores/user-atom";
import { useParams } from "react-router-dom";

type UserPayItemProps = {
  user: UserInfo;
  userBalance: number;
  onPay: (payee: UserInfo) => void;
};

const UserPayItem = ({ user, userBalance, onPay }: UserPayItemProps) => {
  const { id } = useParams<{ id: string | undefined }>();

  return (
    <div
      className="flex flex-col items-center gap-2 cursor-pointer"
      onClick={() => {
        if (id) {
          onPay(user);
        }
      }}
    >
      <Avatar className="w-16 h-16 shadow border">
        <AvatarImage src="" />
        <AvatarFallback className="text-xs">{user.name}</AvatarFallback>
      </Avatar>
      <Badge className="font-mono">{userBalance || 0}</Badge>
    </div>
  );
};

export default UserPayItem;
