import { cn } from "@/lib/utils";
import { HTMLAttributes, PropsWithChildren } from "react";

type UserNameProps = HTMLAttributes<HTMLSpanElement> & PropsWithChildren;

const UserName = ({ children, className, ...props }: UserNameProps) => {
  return (
    <span
      className={cn("bg-gray-100 rounded border px-2", className)}
      {...props}
    >
      {children}
    </span>
  );
};

export default UserName;
