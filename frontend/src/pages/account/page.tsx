import LogOut, { LogOutHandles } from "../../components/logout";
import { useRef } from "react";
import { useAtomValue } from "jotai";
import { userAtom } from "../../stores/user-atom";
import { Button } from "@/components/ui/button";

const Account = () => {
  const user = useAtomValue(userAtom);

  const logOutRef = useRef<LogOutHandles>(null);

  return (
    <>
      <div className="p-16 flex flex-col space-y-8">
        <div className="flex justify-between">
          <p>用户名:</p>
          <p>{user?.username}</p>
        </div>
        <div className="flex justify-between">
          <p>姓名:</p>
          <p>{user?.name}</p>
        </div>

        <Button onClick={() => logOutRef.current?.open()}>退出登录</Button>
      </div>

      <LogOut ref={logOutRef} />
    </>
  );
};

export default Account;
