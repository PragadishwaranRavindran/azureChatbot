import { useEffect } from "react";
import ChatInterface from "@/components/chat-interface";

export default function Chat() {
  useEffect(() => {
    document.title = "AI Assistant Chat";
  }, []);

  return (
    <div className="h-screen flex flex-col bg-chat-container">
      <ChatInterface />
    </div>
  );
}
