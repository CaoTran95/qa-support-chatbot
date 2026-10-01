import Link from "next/link";
import { BOTS, type Bot } from "@/lib/hermes/profiles";
import { cn } from "@/lib/utils";

// Plain links (no client state): the selected bot lives in `?bot=`, so a bot can be shared by URL.
export function BotSwitcher({ current }: { current: Bot }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Chọn bot">
      {BOTS.map((b) => {
        const active = b.profile === current.profile;
        return (
          <Link
            key={b.profile}
            href={`/?bot=${b.profile}`}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm no-underline transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {b.label}
          </Link>
        );
      })}
    </nav>
  );
}
