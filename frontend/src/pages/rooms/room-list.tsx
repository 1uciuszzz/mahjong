import { Room } from "./page";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import JoinRoomForm, { JoinRoomFormHandles } from "./join-room-form";
import { useRef } from "react";
import { useAtomValue } from "jotai";
import { userAtom } from "@/stores/user-atom";
import { formatDate } from "@/utils/format-date";

type RoomItemProps = {
  room: Room;
  onJoin: (room: Room) => void;
};

const RoomItem = ({ room, onJoin }: RoomItemProps) => {
  return (
    <Card
      onClick={() => {
        onJoin(room);
      }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-4">
          <Badge variant={room.active ? `default` : `secondary`}>
            {room.active ? `进行中` : `已关闭`}
          </Badge>
          {room.name}
        </CardTitle>
        <CardDescription className="line-clamp-3">
          房间内成员：{room.users.map((user) => user.name).join(", ")}
        </CardDescription>
      </CardHeader>

      <CardFooter>
        <p className="text-xs text-gray-500">
          创建时间：
          {formatDate(room.createdAt)}
        </p>
      </CardFooter>
    </Card>
  );
};

type RoomListProps = {
  rooms: Room[];
};

const RoomList = ({ rooms }: RoomListProps) => {
  const user = useAtomValue(userAtom);

  const navigate = useNavigate();

  const handleJoin = (room: Room) => {
    if (user && room.users.find((item) => item.id === user.id)) {
      navigate(`/rooms/${room.id}`);
    } else {
      JoinRoomFormRef.current?.setOpen(true, room);
    }
  };

  const JoinRoomFormRef = useRef<JoinRoomFormHandles>(null);

  return (
    <>
      <div className="flex flex-col gap-4">
        {rooms.map((room) => {
          return <RoomItem key={room.id} room={room} onJoin={handleJoin} />;
        })}
      </div>
      <JoinRoomForm ref={JoinRoomFormRef} />
    </>
  );
};

export default RoomList;
