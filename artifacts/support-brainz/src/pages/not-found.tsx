import React from "react";
import { Link } from "wouter";
import { Ghost, Home } from "lucide-react";
import { Button } from "@/components/ui/shared";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground selection:bg-primary/30">
      <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center mb-8 border border-border shadow-xl">
        <Ghost className="w-12 h-12 text-muted-foreground" />
      </div>
      
      <h1 className="text-6xl font-display font-bold text-foreground mb-4 tracking-tighter">404</h1>
      <h2 className="text-xl text-muted-foreground mb-8 text-center max-w-md">
        The page you are looking for has vanished into the knowledge base void.
      </h2>
      
      <Link href="/" className="inline-block">
        <Button className="h-12 px-6 rounded-xl font-medium gap-2 text-base">
          <Home className="w-4 h-4" />
          Return to Chat
        </Button>
      </Link>
    </div>
  );
}
