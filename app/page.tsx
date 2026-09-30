import { Chat } from "@/components/Chat";
import { AdminAuthBar } from "@/components/AdminAuthBar";
import { BotSwitcher } from "@/components/BotSwitcher";
import { HermesStatus } from "@/components/HermesStatus";
import { DEFAULT_BOT, findBot } from "@/lib/hermes/profiles";

export default async function Home({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { bot: botParam } = await searchParams;
  const bot = findBot(botParam) ?? DEFAULT_BOT;
  return (
    <main className="app">
      <header className="header">
        <h1>{bot.label}</h1>
        <BotSwitcher current={bot} />
        <HermesStatus key={bot.profile} profile={bot.profile} />
        <AdminAuthBar />
      </header>
      <Chat key={bot.profile} bot={bot} />
    </main>
  );
}
