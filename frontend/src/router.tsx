import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
  {
    path: "/",
    lazy: async () => ({ Component: (await import("./layout")).default }),
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import("./pages/home/page")).default,
        }),
      },
      {
        path: "/rooms",
        lazy: async () => ({
          Component: (await import("./pages/rooms/page")).default,
        }),
      },
      {
        path: "/rooms/:id",
        lazy: async () => ({
          Component: (await import("./pages/rooms/room-detail")).default,
        }),
      },
      {
        path: "/account",
        lazy: async () => ({
          Component: (await import("./pages/account/page")).default,
        }),
      },
    ],
  },
  {
    path: "/auth",
    lazy: async () => ({
      Component: (await import("./pages/auth/layout")).default,
    }),
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import("./pages/auth/sign-in")).default,
        }),
      },
      {
        path: "sign-up",
        lazy: async () => ({
          Component: (await import("./pages/auth/sign-up")).default,
        }),
      },
    ],
  },
]);
