import { useEffect } from "react";
import { AUTH_API, SignInPayload } from "../../apis/auth";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import {} from "react-hook-form";
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
import { toast } from "sonner";
import { isAxiosError } from "axios";

const schema = z.object({
  username: z
    .string()
    .regex(/^[A-Za-z0-9]+$/, { message: `只允许输入英文和数字` })
    .min(1, { message: `用户名长度不能为空` })
    .max(6, { message: `用户名长度不能超过6位` }),
  password: z
    .string()
    .regex(/^[A-Za-z0-9]+$/, { message: `只允许输入英文和数字` })
    .min(4, { message: `密码长度不能小于4位` })
    .max(16, { message: `密码长度不能超过16位` }),
});

const SignInPage = () => {
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const { isPending, mutate: signIn } = useMutation({
    mutationFn: (payload: SignInPayload) => AUTH_API.SIGN_IN.fn(payload),
    onSuccess: (res) => {
      toast(`登陆成功`);
      localStorage.setItem("token", res.data.token);
      navigate(`/`);
    },
    onError: (error) => {
      if (isAxiosError(error)) {
        toast(error.response?.data.message);
      } else {
        toast(error.message);
      }
    },
  });

  const onSignIn = (values: z.infer<typeof schema>) => {
    signIn(values);
  };

  useEffect(() => {
    if (localStorage.getItem("token")) {
      navigate("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStorage.getItem("token")]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSignIn)}
        className="flex flex-col gap-4"
      >
        <h1 className="text-2xl">登录</h1>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>用户名</FormLabel>
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
              <FormLabel>密码</FormLabel>
              <FormControl>
                <Input {...field} type="password" className="h-10" />
              </FormControl>
              <FormDescription />
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" disabled={isPending}>
          提交
        </Button>
        <div className="flex items-center justify-end">
          <p>没有账号?</p>
          <Link
            to="/auth/sign-up"
            className="underline underline-offset-4 text-blue-500"
          >
            去注册
          </Link>
        </div>
      </form>
    </Form>
  );
};

export default SignInPage;
