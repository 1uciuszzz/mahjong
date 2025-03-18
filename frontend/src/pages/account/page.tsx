import LogOut, { LogOutHandles } from "../../components/logout";
import { useRef } from "react";
import { useAtomValue } from "jotai";
import { userAtom } from "../../stores/user-atom";
import { Button } from "@/components/ui/button";
import ChangeUserInfoForm, {
  ChangeUserInfoFormHandles,
} from "./change-info-form";

const Account = () => {
  const user = useAtomValue(userAtom);

  const logOutRef = useRef<LogOutHandles>(null);

  const ChangeUserInfoFormRef = useRef<ChangeUserInfoFormHandles>(null);

  return (
    <>
      <div className="p-10 flex flex-col space-y-8">
        <div className="flex justify-between">
          <p>用户名:</p>
          <p className="font-mono">{user?.username}</p>
        </div>
        <div className="flex justify-between">
          <p>姓名:</p>
          <p>{user?.name}</p>
        </div>

        <Button
          onClick={() => {
            ChangeUserInfoFormRef.current?.open();
          }}
        >
          修改用户信息
        </Button>

        <Button variant="secondary" onClick={() => logOutRef.current?.open()}>
          退出登录
        </Button>
      </div>

      <LogOut ref={logOutRef} />

      <ChangeUserInfoForm ref={ChangeUserInfoFormRef} />
    </>
  );
};

export default Account;
