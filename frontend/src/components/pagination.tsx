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

        <p>共{count}页</p>
      </PaginationContent>
    </ShadcnPagination>
  );
};

export default Pagination;
