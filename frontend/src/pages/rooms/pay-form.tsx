import { useParams } from "react-router-dom";
import { useImmer } from "use-immer";
import { EXPENDITURES_API } from "../../apis/expenditures";
import { forwardRef, useImperativeHandle } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserInfo } from "@/stores/user-atom";
import { toast } from "sonner";
import { ROOMS_API } from "@/apis/rooms";

export type PayFormHandles = {
  setOpen: (open: boolean, payee: UserInfo) => void;
};

type PayFormProps = object;

const schema = z.object({
  amount: z
    .string()
    .regex(/^[0-9]+$/, { message: `只允许输入数字` })
    .min(1, { message: `最多输入1位长度的金额` })
    .max(6, { message: `最多输入6位长度的金额` }),
});

const PayForm = forwardRef<PayFormHandles, PayFormProps>((_, ref) => {
  const [open, setOpen] = useImmer<boolean>(false);

  const [payee, setPayee] = useImmer<UserInfo | null>(null);

  const { id } = useParams<{ id: string | undefined }>();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: "",
    },
  });

  useImperativeHandle(ref, () => {
    return {
      setOpen: (open: boolean, payee: UserInfo) => {
        form.reset();
        setPayee(payee);
        setOpen(open);
      },
    };
  });

  const queryClient = useQueryClient();

  const { isPending, mutate: pay } = useMutation({
    mutationFn: (amount: number) => {
      if (id && payee) {
        return EXPENDITURES_API.CREATE_EXPENDITURE.fn(id, payee.id, amount);
      } else {
        throw new Error(`参数缺失`);
      }
    },
    onSuccess: () => {
      toast(`支付成功`);
      queryClient.invalidateQueries({
        queryKey: [ROOMS_API.ROOM_DETAIL.key],
      });
      setOpen(false);
    },
    onError: (error) => {
      toast(error.message);
    },
  });

  const onSubmit = (values: z.infer<typeof schema>) => {
    pay(+values.amount);
  };

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
          <DialogTitle>支付</DialogTitle>
          <DialogDescription className="flex items-center gap-1">
            <span>您正在向</span>
            <span className="border rounded bg-gray-100 px-2">
              {payee?.name}
            </span>
            <span>支付</span>
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>支付金额</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-10" type="number" />
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
});

export default PayForm;
