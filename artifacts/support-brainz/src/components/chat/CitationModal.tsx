import React, { useEffect, useRef } from "react";
import { X, FileText, Ticket, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Citation } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

interface DocumentDetail {
  id: number;
  title: string;
  content: string;
  url?: string;
}

interface TicketDetail {
  id: number;
  subject: string;
  conversation: string;
  ticket_id: string;
}

async function fetchDocument(id: number): Promise<DocumentDetail> {
  const res = await fetch(`/api/documents/${id}`);
  if (!res.ok) throw new Error(`Failed to load document (${res.status})`);
  return res.json();
}

async function fetchTicket(id: number): Promise<TicketDetail> {
  const res = await fetch(`/api/tickets/${id}`);
  if (!res.ok) throw new Error(`Failed to load ticket (${res.status})`);
  return res.json();
}

interface CitationModalProps {
  citation: Citation | null;
  onClose: () => void;
}

export function CitationModal({ citation, onClose }: CitationModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const isDoc = citation?.type === "document";
  const isTicket = citation?.type === "ticket";

  const { data: docData, isLoading: docLoading, error: docError } = useQuery({
    queryKey: ["document", citation?.id],
    queryFn: () => fetchDocument(citation!.id),
    enabled: !!citation && isDoc,
    staleTime: 5 * 60 * 1000,
  });

  const { data: ticketData, isLoading: ticketLoading, error: ticketError } = useQuery({
    queryKey: ["ticket", citation?.id],
    queryFn: () => fetchTicket(citation!.id),
    enabled: !!citation && isTicket,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = docLoading || ticketLoading;
  const error = docError || ticketError;

  useEffect(() => {
    if (citation) {
      scrollRef.current?.scrollTo({ top: 0 });
    }
  }, [citation]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {citation && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Modal panel */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-2xl"
            style={{ maxHeight: "80vh" }}
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "80vh" }}>
              {/* Header */}
              <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border/60 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  {isDoc ? (
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-blue-400" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                      <Ticket className="w-4 h-4 text-purple-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      {isDoc ? "Knowledge Base Document" : "Support Ticket"}
                    </span>
                    <h2 className="text-base font-semibold text-foreground truncate">
                      {citation.title}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-accent"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable body */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-sm">Loading content…</span>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-destructive">
                    <AlertCircle className="w-6 h-6" />
                    <span className="text-sm">Failed to load content.</span>
                  </div>
                ) : isDoc && docData ? (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90 leading-relaxed">
                      {docData.content}
                    </pre>
                    {docData.url && !docData.url.startsWith("#") && (
                      <a
                        href={docData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open original source
                      </a>
                    )}
                  </div>
                ) : isTicket && ticketData ? (
                  <div className="space-y-3">
                    {ticketData.ticket_id && (
                      <p className="text-xs text-muted-foreground font-mono">
                        Ticket ID: {ticketData.ticket_id}
                      </p>
                    )}
                    <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90 leading-relaxed">
                      {ticketData.conversation}
                    </pre>
                  </div>
                ) : null}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-border/60 shrink-0 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Match score: {citation.score ? `${(citation.score * 100).toFixed(0)}%` : "—"}
                </span>
                <button
                  onClick={onClose}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-accent"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
