import { Megaphone } from "lucide-react";
import { getSetting } from "@/lib/db";
import { SITE, whatsappUrl } from "@/lib/site";

export default async function AnnouncementBar() {
  const notice = (await getSetting("notice")).trim();

  return (
    <div>
      <a
        href={whatsappUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-brand px-4 py-2.5 text-center text-[15px] leading-snug text-white"
      >
        {SITE.welcome}
      </a>
      {notice && (
        <p className="flex items-center justify-center gap-2 bg-rosa px-4 py-2 text-center text-sm font-bold leading-snug text-ink">
          <Megaphone className="size-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </p>
      )}
    </div>
  );
}
