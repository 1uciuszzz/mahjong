import { useNavigate } from "react-router-dom";
import { useImmer } from "use-immer";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

const BottomNav = () => {
  const [active, setActive] = useImmer<string>("home");

  const navigate = useNavigate();

  return (
    <nav className="fixed w-full left-0 bottom-0">
      <Tabs
        value={active}
        onValueChange={(value) => {
          setActive(value);
        }}
      >
        <TabsList className="grid grid-cols-2 h-12">
          <TabsTrigger
            className="h-full"
            value="home"
            onClick={() => {
              navigate(`/`);
            }}
          >
            首页
          </TabsTrigger>

          <TabsTrigger
            className="h-full"
            value="account"
            onClick={() => {
              navigate(`/account`);
            }}
          >
            账号
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </nav>
  );
};

export default BottomNav;
