import { useState } from "react";
import { Citation } from "@workspace/api-client-react";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  retrieval_steps?: number;
  isPending?: boolean;
};

export function useChatState() {
  const [messages, setMessages] = useState<Message[]>([]);

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const updateMessage = (id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  };

  const removeMessage = (id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  };

  const clearMessages = () => setMessages([]);

  return {
    messages,
    addMessage,
    updateMessage,
    removeMessage,
    clearMessages,
  };
}
