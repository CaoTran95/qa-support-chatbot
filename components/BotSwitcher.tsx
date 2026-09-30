import Link from "next/link";
import { BOTS, type Bot } from "@/lib/hermes/profiles";

// Plain links (no client state): the selected bot lives in `?bot=`, so a bot can be shared by URL.
export function BotSwitcher({ current }: { current: Bot }) {
  return (
    <nav className="bots" aria-label="Chọn bot">
      {BOTS.map((b) => (
        <Link
          key={b.profile}
          href={`/?bot=${b.profile}`}
          className={`bot-tab${b.profile === current.profile ? " bot-tab-active" : ""}`}
          aria-current={b.profile === current.profile ? "page" : undefined}
        >
          {b.label}
        </Link>
      ))}
    </nav>
  );
}
