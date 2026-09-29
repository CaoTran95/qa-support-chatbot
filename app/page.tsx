import { Chat } from "@/components/Chat";
import { HermesStatus } from "@/components/HermesStatus";

export default function Home() {
  return (
    <main className="app">
      <header className="header">
        <h1>QA Support</h1>
        <HermesStatus />
      </header>
      <Chat />
    </main>
  );
}
