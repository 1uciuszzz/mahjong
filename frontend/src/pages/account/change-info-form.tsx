import { AUTH_API, ChangeUserInfoPayload } from "@/apis/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { forwardRef, useImperativeHandle } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useImmer } from "use-immer";
import { z } from "zod";
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
import { Input } from "@/components/ui/input";
import { useSetAtom } from "jotai";
import { userAtom } from "@/stores/user-atom";
import Loader from "@/components/loader";

type ChangeUserInfoFormProps = object;

export type ChangeUserInfoFormHandles = {
  open: () => Promise<void>;
};

const schema = z.object({
  name: z
    .string()
    .regex(/^[\u4e00-\u9fa5A-Za-z]+$/, { message: `只允许输入中文和英文` })
    .min(2, { message: `姓名长度不小于2位` })
    .max(10, { message: `姓名长度不能超过10位` }),
});

const ChangeUserInfoForm = forwardRef<
  ChangeUserInfoFormHandles,
  ChangeUserInfoFormProps
>((_, ref) => {
  const [open, setOpen] = useImmer<boolean>(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
    },
  });

  const { mutateAsync: getUserInfo } = useMutation({
    mutationFn: async () => AUTH_API.USER_INFO.fn(),
    onSuccess: (res) => {
      form.setValue("name", res.data.name);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useImperativeHandle(ref, () => {
    return {
      open: async () => {
        await getUserInfo();
        setOpen(true);
      },
    };
  });

  const setUser = useSetAtom(userAtom);

  const { isPending: changeUserInfoIsPending, mutateAsync: changeUserInfo } =
    useMutation({
      mutationFn: async (payload: ChangeUserInfoPayload) =>
        AUTH_API.CHANGE_USER_INFO.fn(payload),
      onSuccess: (res) => {
        setUser(res.data);
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });

  const onSubmit = (values: z.infer<typeof schema>) => {
    changeUserInfo({
      name: values.name,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改用户信息</DialogTitle>
          <DialogDescription />
        </DialogHeader>

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
                  <FormLabel>姓名</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription />
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={changeUserInfoIsPending}>
              {changeUserInfoIsPending ? <Loader /> : "提交"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
});

export default ChangeUserInfoForm;
