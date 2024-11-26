import { ROOMS_API } from "../../apis/rooms";
import { useImmer } from "use-immer";
import RoomList from "./room-list";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PaginationPayload } from "@/apis/type";
import Loader from "@/components/loader";
import ErrorMsg from "@/components/error";
import Pagination from "@/components/pagination";
import { UserInfo } from "@/stores/user-atom";

export type Room = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  closedAt: string | null;
  users: UserInfo[];
};

const Rooms = () => {
  const [queryParams, setQueryParams] = useImmer<PaginationPayload>({
    page: 1,
    size: 10,
  });

  const navigate = useNavigate();

  const { isPending, isError, error, data, refetch } = useQuery({
    queryKey: [ROOMS_API.GET_ROOMS.key],
    queryFn: () => ROOMS_API.GET_ROOMS.fn(queryParams),
  });

  if (isPending) {
    return <Loader />;
  }

  if (isError) {
    return <ErrorMsg msg={error.message} />;
  }

  return (
    <div className="p-16 flex flex-col gap-4">
      <div className="flex items-center">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/`)}>
          <ArrowLeft />
        </Button>
        <h2 className="text-2xl">房间列表</h2>
      </div>
      <Button
        className="h-10"
        disabled={isPending}
        onClick={() => {
          refetch();
        }}
      >
        刷新数据
      </Button>

      <RoomList rooms={data.data.rooms} />

      <Pagination
        page={queryParams.page}
        size={queryParams.size}
        total={data.data.total}
        onPageChange={(page) => {
          setQueryParams((d) => {
            d.page = page;
            return d;
          });
        }}
      />
    </div>
  );
};

export default Rooms;
