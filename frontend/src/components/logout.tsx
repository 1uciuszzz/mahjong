import { forwardRef, useImperativeHandle } from "react";
import { useImmer } from "use-immer";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { userAtom } from "../stores/user-atom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface LogOutProps {}

export interface LogOutHandles {
  open: () => void;
}

const LogOut = forwardRef<LogOutHandles, LogOutProps>((_, ref) => {
  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
  }));

  const [open, setOpen] = useImmer(false);

  const setUser = useSetAtom(userAtom);

  const navigate = useNavigate();

  const logOut = () => {
    localStorage.clear();
    setUser(null);
    navigate("/auth");
  };

  return (
    <Dialog open={open} onOpenChange={(open) => setOpen(open)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>退出登录</DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <p>您确定要退出登陆吗</p>
        <DialogFooter>
          <Button onClick={logOut}>确定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default LogOut;
