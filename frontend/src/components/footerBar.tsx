import { LucideCopyright } from "lucide-react";
import { Button } from "./ui/button";

const FooterBar = () => {
  return (
    <footer className="flex items-center justify-center gap-2 font-mono">
      <LucideCopyright className="w-4 h-4" />
      <small>
        {new Date().getFullYear()} made by{" "}
        <Button asChild variant="link" className="p-0 text-blue-500">
          <a href="https://github.com/1uciuszzz" target="_blank">
            1uciuszzz
          </a>
        </Button>
      </small>
    </footer>
  );
};

export default FooterBar;
