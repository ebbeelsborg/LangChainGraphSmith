import React, { useState } from "react";
import { Database, Cable, Ticket, FileText, ChevronDown, CheckCircle2, Loader2, Link2, ShieldCheck, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useSeedData, 
  useGetSeedStatus, 
  getGetSeedStatusQueryKey,
  useConnectZendesk,
  useConnectConfluence
} from "@workspace/api-client-react";
import { Button, Input, Label } from "@/components/ui/shared";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onHome?: () => void;
}

export function Sidebar({ onHome }: SidebarProps) {
  const { data: seedStatus, isLoading: statusLoading } = useGetSeedStatus();
  const { mutate: seedData, isPending: isSeeding } = useSeedData();
  const { mutate: connectZendesk, isPending: isConnectingZendesk } = useConnectZendesk();
  const { mutate: connectConfluence, isPending: isConnectingConfluence } = useConnectConfluence();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [openSection, setOpenSection] = useState<string | null>(null);

  // Zendesk Form State
  const [zdSubdomain, setZdSubdomain] = useState("");
  const [zdApiKey, setZdApiKey] = useState("");

  // Confluence Form State
  const [cfUrl, setCfUrl] = useState("");
  const [cfKey, setCfKey] = useState("");
  const [cfToken, setCfToken] = useState("");

  const handleSeed = () => {
    seedData(undefined, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetSeedStatusQueryKey() });
        toast({
          title: "Demo Data Loaded",
          description: data.message || `Loaded ${data.documents_seeded} docs and ${data.tickets_seeded} tickets.`,
        });
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Seeding Failed",
          description: err.message || "An error occurred while seeding data.",
        });
      }
    });
  };

  const handleZendeskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zdSubdomain || !zdApiKey) return;
    
    connectZendesk({ data: { subdomain: zdSubdomain, api_key: zdApiKey } }, {
      onSuccess: (data) => {
        setZdSubdomain("");
        setZdApiKey("");
        setOpenSection(null);
        toast({
          title: "Zendesk Connected",
          description: data.message || `Imported ${data.imported} tickets successfully.`,
        });
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: err.message || "Could not connect to Zendesk.",
        });
      }
    });
  };

  const handleConfluenceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfUrl || !cfToken) return;
    
    connectConfluence({ data: { base_url: cfUrl, space_key: cfKey, api_token: cfToken } }, {
      onSuccess: (data) => {
        setCfUrl("");
        setCfKey("");
        setCfToken("");
        setOpenSection(null);
        toast({
          title: "Confluence Connected",
          description: data.message || `Imported ${data.imported} documents successfully.`,
        });
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: err.message || "Could not connect to Confluence.",
        });
      }
    });
  };

  return (
    <div className="w-[320px] h-screen bg-sidebar border-r border-sidebar-border flex flex-col flex-shrink-0 z-20 shadow-2xl">
      {/* Brand Header — clicking acts as Home */}
      <button
        onClick={onHome}
        className="h-16 px-6 flex items-center border-b border-border/50 w-full text-left hover:bg-accent/40 transition-colors group"
        title="Go to home"
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/logo.png`} 
          alt="SupportBrainz" 
          className="w-8 h-8 mr-3 object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] group-hover:drop-shadow-[0_0_12px_rgba(59,130,246,0.8)] transition-all" 
        />
        <h1 className="font-display font-bold text-lg text-foreground tracking-wide">
          SupportBrainz
        </h1>
      </button>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Knowledge Base Section */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
            <Database className="w-3.5 h-3.5" />
            Knowledge Base
          </h2>
          
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", seedStatus?.seeded ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-muted-foreground")} />
                <span className="text-sm font-medium">
                  {statusLoading ? "Checking..." : seedStatus?.seeded ? "System Ready" : "No Data"}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-background rounded-lg p-3 border border-border/50 flex flex-col items-center justify-center gap-1">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-muted-foreground">Docs</span>
                <span className="text-lg font-display font-semibold">{seedStatus?.document_count || 0}</span>
              </div>
              <div className="bg-background rounded-lg p-3 border border-border/50 flex flex-col items-center justify-center gap-1">
                <Ticket className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-muted-foreground">Tickets</span>
                <span className="text-lg font-display font-semibold">{seedStatus?.ticket_count || 0}</span>
              </div>
            </div>

            <Button 
              className="w-full relative overflow-hidden group" 
              variant="secondary"
              onClick={handleSeed}
              disabled={isSeeding}
            >
              {isSeeding ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</>
              ) : (
                <><ShieldCheck className="w-4 h-4 mr-2" /> Load Demo Data</>
              )}
            </Button>
          </div>
        </section>

        {/* Integrations Section */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
            <Cable className="w-3.5 h-3.5" />
            Live Integrations
          </h2>

          <div className="space-y-2">
            {/* Zendesk Accordion */}
            <div className="bg-card rounded-xl border border-border overflow-hidden transition-all duration-300">
              <button 
                onClick={() => setOpenSection(openSection === "zendesk" ? null : "zendesk")}
                className="w-full px-4 py-3 flex items-center justify-between bg-transparent hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Link2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-medium">Zendesk</span>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", openSection === "zendesk" && "rotate-180")} />
              </button>
              
              <AnimatePresence initial={false}>
                {openSection === "zendesk" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 border-t border-border bg-background/50">
                      <form onSubmit={handleZendeskSubmit} className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Subdomain</Label>
                          <Input 
                            value={zdSubdomain} 
                            onChange={(e) => setZdSubdomain(e.target.value)}
                            placeholder="company.zendesk.com" 
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">API Key</Label>
                          <Input 
                            type="password"
                            value={zdApiKey} 
                            onChange={(e) => setZdApiKey(e.target.value)}
                            placeholder="••••••••••••" 
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                        <Button type="submit" size="sm" className="w-full h-8 mt-2" disabled={isConnectingZendesk}>
                          {isConnectingZendesk ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : "Connect & Sync"}
                        </Button>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Confluence Accordion */}
            <div className="bg-card rounded-xl border border-border overflow-hidden transition-all duration-300">
              <button 
                onClick={() => setOpenSection(openSection === "confluence" ? null : "confluence")}
                className="w-full px-4 py-3 flex items-center justify-between bg-transparent hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <Link2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-medium">Confluence</span>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", openSection === "confluence" && "rotate-180")} />
              </button>
              
              <AnimatePresence initial={false}>
                {openSection === "confluence" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 border-t border-border bg-background/50">
                      <form onSubmit={handleConfluenceSubmit} className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Base URL</Label>
                          <Input 
                            value={cfUrl} 
                            onChange={(e) => setCfUrl(e.target.value)}
                            placeholder="https://company.atlassian.net" 
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Space Key (Optional)</Label>
                          <Input 
                            value={cfKey} 
                            onChange={(e) => setCfKey(e.target.value)}
                            placeholder="ENG" 
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">API Token</Label>
                          <Input 
                            type="password"
                            value={cfToken} 
                            onChange={(e) => setCfToken(e.target.value)}
                            placeholder="••••••••••••" 
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                        <Button type="submit" size="sm" className="w-full h-8 mt-2" disabled={isConnectingConfluence}>
                          {isConnectingConfluence ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : "Connect & Sync"}
                        </Button>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>
      </div>
      
      {/* Footer hint */}
      <div className="p-4 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5" />
        <span>RAG system powered by pgvector</span>
      </div>
    </div>
  );
}
