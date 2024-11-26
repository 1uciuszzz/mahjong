import { ROOMS_API } from "@/apis/rooms";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation } from "@tanstack/react-query";
import { forwardRef, useImperativeHandle } from "react";
import { useImmer } from "use-immer";
import { Room } from "./page";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export type JoinRoomFormHandles = {
  setOpen: (open: boolean, room: Room) => void;
};

type JoinRoomFormProps = object;

const schema = z.object({
  password: z
    .string()
    .regex(/^[A-Za-z0-9]+$/, { message: `只允许输入英文和数字` })
    .length(6, { message: `请输入6位长度的房间密码` }),
});

const JoinRoomForm = forwardRef<JoinRoomFormHandles, JoinRoomFormProps>(
  (_, ref) => {
    const [open, setOpen] = useImmer<boolean>(false);

    const [room, setRoom] = useImmer<Room | null>(null);

    const form = useForm<z.infer<typeof schema>>({
      resolver: zodResolver(schema),
      defaultValues: {
        password: "",
      },
    });

    const navigate = useNavigate();

    const { isPending, mutate: joinRoom } = useMutation({
      mutationFn: (password: string) => {
        if (room) {
          return ROOMS_API.JOIN_ROOM.fn(room.id, password);
        } else {
          throw new Error(`没有房间信息`);
        }
      },
      onSuccess: (res) => {
        toast(`加入房间成功`);
        navigate(`/rooms/${res.data.id}`);
      },
      onError: (error) => {
        toast(error.message);
      },
    });

    const onSubmit = (values: z.infer<typeof schema>) => {
      joinRoom(values.password);
    };

    useImperativeHandle(ref, () => {
      return {
        setOpen: (open: boolean, room: Room) => {
          setRoom(room);
          setOpen(open);
        },
      };
    });

    return (
      <Dialog
        open={open}
        onOpenChange={(open) => {
          setOpen(open);
        }}
      >
        <DialogContent
          className="max-w-sm"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{room?.name}</DialogTitle>
            <DialogDescription>
              房间内成员：{room?.users.map((user) => user.name).join(", ")}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>房间密码</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-10" />
                    </FormControl>
                    <FormDescription />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" disabled={isPending}>
                提交
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  }
);

export default JoinRoomForm;
