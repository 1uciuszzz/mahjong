import Brand from "@/components/brand";
import { Outlet } from "react-router-dom";

const AuthLayout = () => {
  return (
    <div className="p-10">
      <div className="flex items-center justify-center gap-4">
        <Brand className="w-16 h-16" />
        <h1 className="text-center text-3xl">笨钟大学堂</h1>
      </div>
      <Outlet />
    </div>
  );
};

export default AuthLayout;
