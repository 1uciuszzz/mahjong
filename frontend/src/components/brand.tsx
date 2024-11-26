import { HTMLAttributes } from "react";
import brandSrc from "../assets/18e714e5620a28d4ce0bcf57d9ca775a16c7577b6f33dc6a5bfc4292b5ef4274.webp";

type BrandProps = HTMLAttributes<HTMLImageElement>;

const Brand = ({ ...props }: BrandProps) => {
  return <img src={brandSrc} {...props} />;
};

export default Brand;
