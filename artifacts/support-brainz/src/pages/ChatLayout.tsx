import React, { useRef, useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useChatState } from "@/hooks/use-chat-state";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { CitationModal } from "@/components/chat/CitationModal";
import { useSendMessage, Citation } from "@workspace/api-client-react";
import { Send, Sparkles, MessageSquare, SquarePen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function ChatLayout() {
  const { messages, addMessage, updateMessage, clearMessages } = useChatState();
  const { mutate: sendMessage } = useSendMessage();
  const [input, setInput] = useState("");
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const isGenerating = messages[messages.length - 1]?.isPending;

  const handleGoHome = () => {
    clearMessages();
    setInput("");
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages]);

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userQuery = input.trim();
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMsgId = crypto.randomUUID();
    addMessage({ id: userMsgId, role: "user", content: userQuery });

    const aiMsgId = crypto.randomUUID();
    addMessage({ id: aiMsgId, role: "assistant", content: "", isPending: true });

    sendMessage({ data: { query: userQuery } }, {
      onSuccess: (data) => {
        updateMessage(aiMsgId, {
          content: data.answer,
          citations: data.citations,
          retrieval_steps: data.retrieval_steps,
          isPending: false
        });
      },
      onError: (err: any) => {
        updateMessage(aiMsgId, {
          content: "I encountered an error while trying to process your request. Please ensure the backend and API integrations are fully configured.",
          isPending: false
        });
        toast({
          variant: "destructive",
          title: "Failed to generate answer",
          description: err.message || "Unknown error occurred.",
        });
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const suggestedQueries = [
    "How do I reset my password?",
    "What are the rate limits for the API?",
    "How do I configure SSO integration?",
    "How do I deploy my app to production?"
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground selection:bg-primary/30">
      <Sidebar />

      <main className="flex-1 flex flex-col relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-background to-background">

        {/* Top bar — only shown when there are messages */}
        {messages.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 bg-background/60 backdrop-blur-md shrink-0">
            <span className="text-sm font-medium text-foreground/80">SupportBrainz</span>
            <button
              onClick={handleGoHome}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-accent"
              title="Start a new chat"
            >
              <SquarePen className="w-3.5 h-3.5" />
              New Chat
            </button>
          </div>
        )}

        {/* Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto pb-32">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-2xl mx-auto">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(59,130,246,0.2)]"
              >
                <Sparkles className="w-8 h-8 text-primary" />
              </motion.div>
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-3xl font-display font-bold mb-3"
              >
                How can I help you today?
              </motion.h2>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-muted-foreground mb-10 text-lg"
              >
                I'm SupportBrainz, a RAG-powered assistant connected to your knowledge base and tickets. I can help you answer support requests.
              </motion.p>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full"
              >
                {suggestedQueries.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(q); }}
                    className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-accent hover:border-primary/50 text-left transition-all group"
                  >
                    <MessageSquare className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-sm font-medium">{q}</span>
                  </button>
                ))}
              </motion.div>
            </div>
          ) : (
            <div className="flex flex-col">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    onCitationClick={setSelectedCitation}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-12">
          <div className="max-w-4xl mx-auto relative">
            <form
              onSubmit={handleSubmit}
              className="relative flex items-end shadow-xl shadow-black/20 rounded-2xl overflow-hidden border border-border bg-card/80 backdrop-blur-xl focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Message SupportBrainz..."
                className="w-full max-h-[200px] min-h-[56px] py-4 pl-4 pr-14 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-0 text-base"
                rows={1}
              />
              <button
                type="submit"
                disabled={!input.trim() || isGenerating}
                className={cn(
                  "absolute right-3 bottom-3 p-2 rounded-xl transition-all duration-200",
                  input.trim() && !isGenerating
                    ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(59,130,246,0.4)] hover:bg-primary/90 hover:scale-105 active:scale-95"
                    : "bg-accent text-muted-foreground cursor-not-allowed"
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="text-center mt-3 text-[11px] text-muted-foreground">
              SupportBrainz can make mistakes. Consider verifying critical information.
            </div>
          </div>
        </div>

      </main>

      {/* Citation detail modal */}
      <CitationModal
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  );
}
