import { forwardRef, useImperativeHandle } from "react";
import { useParams } from "react-router-dom";
import { useImmer } from "use-immer";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

interface ShareProps {}

export interface ShareHandles {
  open: (open: boolean, password: string) => void;
}

const Share = forwardRef<ShareHandles, ShareProps>((_, ref) => {
  const [open, setOpen] = useImmer<boolean>(false);

  const [password, setPassword] = useImmer<string | null>(null);

  useImperativeHandle(ref, () => {
    return {
      open: (open: boolean, password: string) => {
        setPassword(password);
        setOpen(open);
      },
    };
  });

  const { id } = useParams<{ id: string }>();

  const shareLink = `${location.origin}/rooms/${id}?password=${password}`;

  const { isPending: copyLinkIsPending, mutate: copyLink } = useMutation({
    mutationFn: () => {
      return navigator.clipboard.writeText(shareLink);
    },
    onSuccess: () => {
      toast(`复制成功`);
    },
    onError: (error) => {
      toast(error.message);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
      }}
    >
      <DialogContent className="max-w-sm flex flex-col items-center">
        <DialogHeader>
          <DialogTitle>分享房间</DialogTitle>
          <DialogDescription />
        </DialogHeader>

        <QRCodeSVG value={shareLink} />

        <p className="text-sm flex items-center">
          <span>房间密码：</span>
          <span className="font-mono border rounded bg-gray-100 px-2">
            {password}
          </span>
        </p>

        <Button
          disabled={copyLinkIsPending}
          variant="link"
          onClick={() => {
            copyLink();
          }}
        >
          点此复制分享链接
        </Button>
      </DialogContent>
    </Dialog>
  );
});

export default Share;
