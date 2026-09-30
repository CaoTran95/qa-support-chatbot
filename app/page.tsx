import { Chat } from "@/components/Chat";
import { AdminAuthBar } from "@/components/AdminAuthBar";
import { HermesStatus } from "@/components/HermesStatus";

export default function Home() {
  return (
    <main className="app">
      <header className="header">
        <h1>QA Support</h1>
        <HermesStatus />
        <AdminAuthBar />
      </header>
      <Chat />
    </main>
  );
}
