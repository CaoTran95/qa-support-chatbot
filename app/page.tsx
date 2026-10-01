import { Chat } from "@/components/Chat";
import { DEFAULT_BOT, findBot } from "@/lib/hermes/profiles";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { bot: botParam } = await searchParams;
  const bot = findBot(botParam) ?? DEFAULT_BOT;
  return <Chat key={bot.profile} bot={bot} />;
}
