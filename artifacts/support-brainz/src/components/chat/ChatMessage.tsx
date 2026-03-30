import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Cpu, Loader2 } from "lucide-react";
import { Message } from "@/hooks/use-chat-state";
import { CitationsList } from "./Citations";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function ChatMessage({ message }: { message: Message }) {
  const isAi = message.role === "assistant";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex w-full py-6",
        isAi ? "bg-card/30 border-y border-border/50" : "bg-transparent"
      )}
    >
      <div className="max-w-4xl mx-auto flex w-full gap-5 px-4 sm:px-6">
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          {isAi ? (
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Bot className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-accent border border-border flex items-center justify-center text-foreground">
              <User className="w-5 h-5" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-medium text-sm">
              {isAi ? "SupportBrainz" : "You"}
            </span>
            {isAi && message.retrieval_steps && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded-sm">
                <Cpu className="w-3 h-3" />
                RAG Level {message.retrieval_steps}
              </span>
            )}
          </div>

          {message.isPending ? (
            <div className="flex items-center gap-2 text-muted-foreground py-2 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm">Synthesizing response...</span>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm md:prose-base max-w-none text-foreground/90 leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {message.citations && <CitationsList citations={message.citations} />}
        </div>
      </div>
    </motion.div>
  );
}
