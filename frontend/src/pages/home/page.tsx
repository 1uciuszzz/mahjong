import bannerURL from "../../assets/banner.svg";
import FooterBar from "../../components/footerBar";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import CreateRoomForm, { CreateRoomFormHandles } from "./creat-room-form";
import Brand from "@/components/brand";

const HomePage = () => {
  const CreateRoomFormRef = useRef<CreateRoomFormHandles>(null);

  const navigate = useNavigate();

  return (
    <div className="h-full p-10 flex flex-col gap-10 items-center">
      <div className="flex items-center gap-2">
        <Brand className="w-16 h-16" />
        <h2 className="text-3xl">笨钟大学堂</h2>
      </div>
      <div className="w-full flex gap-10">
        <Button
          className="flex-1 h-16"
          onClick={() => {
            CreateRoomFormRef.current?.open();
          }}
        >
          创建房间
        </Button>
        <Button
          className="flex-1 h-16"
          onClick={() => {
            navigate(`/rooms`);
          }}
        >
          房间列表
        </Button>
      </div>

      <div
        className="h-64 w-full"
        style={{
          backgroundImage: `url(${bannerURL})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "contain",
        }}
      ></div>

      <FooterBar />

      <CreateRoomForm ref={CreateRoomFormRef} />
    </div>
  );
};

export default HomePage;
