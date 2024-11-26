import { ROOMS_API } from "../../apis/rooms";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useRef } from "react";
import Share, { ShareHandles } from "./share";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CircleCheckBig, Share2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Loader from "@/components/loader";
import ErrorMsg from "@/components/error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDate } from "@/utils/format-date";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import UserPayItem from "./user-pay-item";
import PayForm, { PayFormHandles } from "./pay-form";
import ExpenditureItem from "./expenditure-item";
import { useAtomValue } from "jotai";
import { userAtom } from "@/stores/user-atom";

const RoomDetail = () => {
  const { id } = useParams<{ id: string | undefined }>();

  const [searchParams] = useSearchParams();

  const password = searchParams.get("password");

  const navigate = useNavigate();

  const {
    isPending: autoJoinIsPending,
    isError: autoJoinIsError,
    error: autoJoinError,
  } = useQuery({
    queryKey: [ROOMS_API.JOIN_ROOM.key, password],
    queryFn: async () => {
      if (password && id) {
        await ROOMS_API.JOIN_ROOM.fn(id, password);
        await refetch();
        return true;
      } else {
        return null;
      }
    },
  });

  const { isPending, isError, error, data, refetch } = useQuery({
    queryKey: [ROOMS_API.ROOM_DETAIL.key],
    queryFn: () => {
      if (id) {
        return ROOMS_API.ROOM_DETAIL.fn(id);
      } else {
        throw new Error(`找不到房间编号`);
      }
    },
    retry: false,
  });

  const queryClient = useQueryClient();

  const { isPending: closeRoomIsPending, mutate: closeRoom } = useMutation({
    mutationFn: () => {
      if (id) {
        return ROOMS_API.CLOSE_ROOM.fn(id);
      } else {
        throw new Error(`找不到房间编号`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [ROOMS_API.ROOM_DETAIL.key],
      });
    },
  });

  const ShareRef = useRef<ShareHandles>(null);

  const PayFormRef = useRef<PayFormHandles>(null);

  const userInfo = useAtomValue(userAtom);

  if (isPending || autoJoinIsPending) {
    return <Loader />;
  }

  if (isError || autoJoinIsError) {
    return <ErrorMsg msg={error?.message || autoJoinError?.message} />;
  }

  return (
    <div className="p-10 flex flex-col gap-4">
      <div className="flex items-center">
        <Button size="icon" variant="ghost" onClick={() => navigate(`/rooms`)}>
          <ArrowLeft />
        </Button>
        <h2 className="text-xl">房间详情 - {data.data.roomWithUsers.name}</h2>
        <Button
          variant="default"
          className="ml-auto"
          size="icon"
          onClick={() =>
            ShareRef.current?.open(true, data.data.roomWithUsers.password)
          }
        >
          <Share2 />
        </Button>
      </div>

      {data.data.roomWithUsers.active ? (
        <Button
          size="lg"
          onClick={() => {
            refetch();
          }}
          disabled={isPending}
        >
          刷新数据
        </Button>
      ) : null}

      {data.data.roomWithUsers.active ? null : (
        <Alert>
          <CircleCheckBig className="h-4 w-4" />
          <AlertTitle>该房间已关闭</AlertTitle>
          <AlertDescription className="text-gray-500">
            房间关闭于
            {data.data.roomWithUsers.closedAt &&
              formatDate(data.data.roomWithUsers.closedAt)}
          </AlertDescription>
        </Alert>
      )}

      <ScrollArea className="w-full">
        <div className="flex gap-6 py-10 px-2">
          {data.data.roomWithUsers.users.map((user) => {
            return (
              <UserPayItem
                key={user.id}
                user={user}
                userBalance={
                  data.data.roomWithUsers.active
                    ? data.data.expenditureStats?.[user.id]?.balance || 0
                    : data.data.roomWithUsers.userBalances
                      ? data.data.roomWithUsers.userBalances?.[user.id]?.balance
                      : 0
                }
                onPay={(payee) => {
                  if (userInfo?.id !== payee.id) {
                    PayFormRef.current?.setOpen(true, payee);
                  }
                }}
              />
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {data.data.expenditures.map((expenditure) => {
        return (
          <ExpenditureItem key={expenditure.id} expenditure={expenditure} />
        );
      })}

      {data.data.roomWithUsers.active ? (
        <Button
          size="lg"
          onClick={() => {
            closeRoom();
          }}
          disabled={closeRoomIsPending}
        >
          关闭房间
        </Button>
      ) : null}

      <Share ref={ShareRef} />

      <PayForm ref={PayFormRef} />
    </div>
  );
};

export default RoomDetail;
