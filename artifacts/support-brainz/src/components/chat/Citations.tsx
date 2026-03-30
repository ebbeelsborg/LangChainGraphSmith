import React from "react";
import { FileText, Ticket } from "lucide-react";
import { Citation } from "@workspace/api-client-react";
import { motion } from "framer-motion";

interface CitationsListProps {
  citations: Citation[];
  onCitationClick: (citation: Citation) => void;
}

export function CitationsList({ citations, onCitationClick }: CitationsListProps) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-border/50">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Sources Retrieved
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {citations.map((cite, idx) => (
          <motion.button
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={idx}
            onClick={() => onCitationClick(cite)}
            className="group text-left relative bg-background/50 border border-border rounded-xl p-3 hover:border-primary/50 hover:bg-background transition-all duration-300 cursor-pointer w-full"
            title="Click to view full content"
          >
            <div className="flex items-start gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                {/* Citation number matching inline [1][2][3] references */}
                <span className="flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 flex-shrink-0">
                  {idx + 1}
                </span>
                {cite.type === "ticket" ? (
                  <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Ticket className="w-3 h-3" /> Ticket
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <FileText className="w-3 h-3" /> Document
                  </span>
                )}
                {cite.score && (
                  <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                    {(cite.score * 100).toFixed(0)}% match
                  </span>
                )}
              </div>
            </div>

            <h5 className="text-sm font-medium text-foreground mb-1 line-clamp-1 group-hover:text-primary transition-colors">
              {cite.title}
            </h5>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              "{cite.snippet}"
            </p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
