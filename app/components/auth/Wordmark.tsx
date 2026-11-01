import { WORDMARK } from "@/lib/config/brand-assets";
import { PLATFORM_NAME } from "@/lib/config/platform";

export default function Wordmark() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={WORDMARK} alt={PLATFORM_NAME} width={108} height={18} className="block h-[18px] w-auto" />;
}
