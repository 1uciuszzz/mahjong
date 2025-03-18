import { CreateRoomPayload, ROOMS_API } from "@/apis/rooms";
import { useMutation } from "@tanstack/react-query";
import { forwardRef, useImperativeHandle } from "react";
import { useNavigate } from "react-router-dom";
import { useImmer } from "use-immer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { randomStr } from "@/utils/random-str";

type CreateRoomFormProps = object;

export type CreateRoomFormHandles = {
  open: () => void;
};

const schema = z.object({
  name: z
    .string()
    .regex(/^[\u4e00-\u9fa5A-Za-z0-9]+$/, {
      message: `只允许输入中文、英文和数字`,
    })
    .min(2, { message: `房间名称长度不小于2位` })
    .max(10, { message: `房间名称长度不能超过10位` }),
  password: z
    .string()
    .regex(/^[A-Za-z0-9]+$/, { message: `只允许输入英文和数字` })
    .length(6, { message: `请输入6位长度的房间密码` }),
});

const CreateRoomForm = forwardRef<CreateRoomFormHandles, CreateRoomFormProps>(
  (_, ref) => {
    const form = useForm<z.infer<typeof schema>>({
      resolver: zodResolver(schema),
      defaultValues: {
        name: "",
        password: "",
      },
    });

    useImperativeHandle(ref, () => ({
      open: () => {
        form.reset();
        setOpen(true);
      },
    }));

    const [open, setOpen] = useImmer(false);

    const navigate = useNavigate();

    const { isPending: isCreateRoomPending, mutate: createRoom } = useMutation({
      mutationFn: (payload: CreateRoomPayload) =>
        ROOMS_API.CREATE_ROOM.fn(payload),
      onSuccess: (res) => {
        setOpen(false);
        navigate(`/rooms/${res.data.id}`);
      },
      onError: (error) => {
        toast(error.message);
      },
    });

    const onSubmit = (values: z.infer<typeof schema>) => {
      createRoom(values);
    };

    const [isCustom, setIsCustom] = useImmer<boolean>(false);

    const handleQuickCreate = () => {
      const name = randomStr(6);
      const password = randomStr(6);
      createRoom({
        name,
        password,
      });
    };

    return (
      <Dialog open={open} onOpenChange={(open) => setOpen(open)}>
        <DialogContent
          className="max-w-sm"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>创建房间</DialogTitle>
            <DialogDescription />
          </DialogHeader>

          <Button onClick={handleQuickCreate}>快速创建</Button>

          <Button
            variant="secondary"
            onClick={() => {
              setIsCustom((d) => !d);
            }}
          >
            自定义
          </Button>

          {isCustom && (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>房间名称</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-10" />
                      </FormControl>
                      <FormDescription />
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                <Button type="submit" size="lg" disabled={isCreateRoomPending}>
                  提交
                </Button>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    );
  }
);

export default CreateRoomForm;
