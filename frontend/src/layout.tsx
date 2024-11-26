import { Outlet, useNavigate } from "react-router-dom";

import BottomNav from "./components/bottomNav";

import { AUTH_API } from "./apis/auth";
import { useSetAtom } from "jotai";
import { userAtom } from "./stores/user-atom";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

const RootLayout = () => {
  const accessToken = localStorage.getItem(`token`);

  const navigate = useNavigate();

  useEffect(() => {
    if (!accessToken) {
      navigate(`/`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const setUser = useSetAtom(userAtom);

  useQuery({
    queryKey: [AUTH_API.USER_INFO.key],
    queryFn: () => AUTH_API.USER_INFO.fn(),
    select: (res) => {
      setUser(res.data);
      return res;
    },
  });

  return (
    <div className="min-h-screen">
      <Outlet />
      <BottomNav />
    </div>
  );
};

export default RootLayout;
