import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

type SenderRole = "hospital" | "ambulance" | "admin";

interface Message {
  id: string;
  emergency_id: string;
  sender_id: string;
  sender_role: SenderRole;
  message: string;
  read: boolean;
  created_at: string;
}

interface EmergencyChatProps {
  emergencyId: string;
  /** Current user's role (hospital | ambulance | admin) */
  myRole: SenderRole;
  /** Current user id (auth.uid()) */
  myUserId: string;
  /** Optional class for container */
  className?: string;
  /** Render as collapsible inline panel (default true) */
  collapsible?: boolean;
}

const EmergencyChat = ({
  emergencyId,
  myRole,
  myUserId,
  className,
  collapsible = true,
}: EmergencyChatProps) => {
  const [open, setOpen] = useState(!collapsible);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history + subscribe to realtime
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("emergency_messages")
        .select("*")
        .eq("emergency_id", emergencyId)
        .order("created_at", { ascending: true });
      if (mounted && data) setMessages(data as Message[]);
    })();

    const channel = supabase
      .channel(`emergency_chat_${emergencyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "emergency_messages",
          filter: `emergency_id=eq.${emergencyId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => [...prev, msg]);
          if (msg.sender_id !== myUserId && (!open)) {
            setUnread((n) => n + 1);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [emergencyId, myUserId, open]);

  // Auto-scroll & clear unread on open
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }, 50);
    }
  }, [open, messages.length]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const { error } = await supabase.from("emergency_messages").insert({
      emergency_id: emergencyId,
      sender_id: myUserId,
      sender_role: myRole,
      message: trimmed,
    });
    if (!error) setText("");
    setSending(false);
  };

  if (collapsible && !open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={cn("relative", className)}
        onClick={() => setOpen(true)}
      >
        <MessageSquare className="mr-2 h-4 w-4" />
        Chat
        {unread > 0 && (
          <Badge
            variant="destructive"
            className="ml-2 h-5 min-w-[1.25rem] px-1 text-xs"
          >
            {unread}
          </Badge>
        )}
      </Button>
    );
  }

  return (
    <div className={cn("flex flex-col rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4" />
          Hospital ↔ Ambulance Chat
        </div>
        {collapsible && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ScrollArea className="h-56" ref={scrollRef as any}>
        <div className="space-y-2 p-3">
          {messages.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">
              No messages yet. Start the conversation.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === myUserId;
              return (
                <div
                  key={m.id}
                  className={cn("flex", mine ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-1.5 text-sm",
                      mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    <div className="text-[10px] opacity-70">
                      {m.sender_role}
                    </div>
                    <div className="whitespace-pre-wrap break-words">
                      {m.message}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
      <div className="flex gap-2 border-t p-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message…"
          disabled={sending}
        />
        <Button onClick={send} disabled={sending || !text.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default EmergencyChat;