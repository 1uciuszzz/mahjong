import { Button } from "./ui/button";
import {
  PaginationContent,
  PaginationItem,
  PaginationLink,
  Pagination as ShadcnPagination,
} from "./ui/pagination";

type PaginationProps = {
  page: number;
  size: number;
  total: number;
  onPageChange: (page: number) => void;
};

const Pagination = ({ page, size, total, onPageChange }: PaginationProps) => {
  const count = Math.ceil(total / size);

  return (
    <div className="flex flex-col items-center gap-4">
      <ShadcnPagination>
        <PaginationContent className="gap-4">
          <PaginationItem>
            <Button
              disabled={page < 2}
              onClick={() => {
                onPageChange(page - 1);
              }}
            >
              上一页
            </Button>
          </PaginationItem>

          <PaginationItem>
            <PaginationLink isActive>{page}</PaginationLink>
          </PaginationItem>

          <PaginationItem>
            <Button
              disabled={page > count - 1}
              onClick={() => {
                onPageChange(page + 1);
              }}
            >
              下一页
            </Button>
          </PaginationItem>
        </PaginationContent>
      </ShadcnPagination>
      <p className="flex items-center gap-1">
        <span>共</span>
        <span className="border rounded bg-gray-100 px-2 font-mono">
          {count}
        </span>
        <span>页</span>
      </p>
    </div>
  );
};

export default Pagination;
