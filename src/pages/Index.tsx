import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import ChatMessage from "@/components/ChatMessage";
import TypingIndicator from "@/components/TypingIndicator";
import UserProfile from "@/components/UserProfile";
import RoomSelector from "@/components/RoomSelector";
import AdminDashboard from "@/components/AdminDashboard";
import ImageUpload from "@/components/ImageUpload";
import { User, Session } from "@supabase/supabase-js";
import { Send, LogOut, Shield } from "lucide-react";

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  image_url: string | null;
  profiles: {
    username: string;
  };
}

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [currentUsername, setCurrentUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      checkAdminStatus();
      joinGlobalRoom();
    }
  }, [user]);

  useEffect(() => {
    if (user && currentRoomId !== undefined) {
      fetchMessages();
      subscribeToMessages();
      subscribeToPresence();
    }
  }, [user, currentRoomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    
    if (data) {
      setCurrentUsername(data.username);
    }
  };

  const checkAdminStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();
    
    setIsAdmin(!!data);
  };

  const joinGlobalRoom = async () => {
    if (!user) return;
    const globalRoomId = "00000000-0000-0000-0000-000000000000";
    
    const { data: existing } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", globalRoomId)
      .eq("user_id", user.id)
      .single();

    if (!existing) {
      await supabase.from("room_members").insert({
        room_id: globalRoomId,
        user_id: user.id
      });
    }
  };

  const fetchMessages = async () => {
    let query = supabase
      .from("messages")
      .select("id, user_id, content, created_at, image_url, room_id")
      .order("created_at", { ascending: true })
      .limit(50);

    if (currentRoomId === null) {
      query = query.is("room_id", null);
    } else {
      query = query.eq("room_id", currentRoomId);
    }

    const { data: messagesData, error } = await query;

    if (error) {
      toast.error("Failed to load messages");
      return;
    }

    if (!messagesData) return;

    const messagesWithProfiles = await Promise.all(
      messagesData.map(async (msg) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", msg.user_id)
          .single();

        return {
          ...msg,
          profiles: { username: profile?.username || "Unknown" },
        };
      })
    );

    setMessages(messagesWithProfiles as Message[]);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages-${currentRoomId || "global"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const msgRoomId = payload.new.room_id;
          if (msgRoomId !== currentRoomId) return;

          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", payload.new.user_id)
            .single();

          const newMsg = {
            ...payload.new,
            profiles: { username: profile?.username || "Unknown" },
          } as Message;

          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToPresence = () => {
    const channel = supabase.channel(`typing-${currentRoomId || "global"}`);

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const typing = Object.values(state)
          .flat()
          .filter((presence: any) => presence.typing && presence.username !== currentUsername)
          .map((presence: any) => presence.username);
        setTypingUsers(typing);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleTyping = () => {
    if (!currentUsername) return;

    const channel = supabase.channel(`typing-${currentRoomId || "global"}`);
    channel.track({ username: currentUsername, typing: true });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      channel.track({ username: currentUsername, typing: false });
    }, 2000);
  };

  const handleImageUpload = (imageUrl: string) => {
    setNewMessage(`[Image: ${imageUrl}]`);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    let imageUrl = null;
    let content = newMessage.trim();
    
    const imageMatch = content.match(/\[Image: (.*?)\]/);
    if (imageMatch) {
      imageUrl = imageMatch[1];
      content = content.replace(/\[Image: .*?\]/, "").trim() || "📷 Image";
    }

    const { error } = await supabase.from("messages").insert({
      user_id: user.id,
      content,
      image_url: imageUrl,
      room_id: currentRoomId
    });

    if (error) {
      toast.error("Failed to send message");
      return;
    }

    setNewMessage("");
    const channel = supabase.channel(`typing-${currentRoomId || "global"}`);
    channel.track({ username: currentUsername, typing: false });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border p-4 space-y-4 overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
            <span className="text-xl font-bold text-primary-foreground">V</span>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Voxa
          </h1>
        </div>

        {isAdmin && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setIsAdminOpen(true)}
          >
            <Shield className="w-4 h-4 mr-2" />
            Admin Dashboard
          </Button>
        )}

        <RoomSelector
          currentRoomId={currentRoomId}
          onRoomChange={setCurrentRoomId}
          userId={user.id}
        />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="bg-card border-b border-border shadow-lg">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {currentRoomId === null ? "Global Room" : "Private Room"}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedUserId(user.id);
                  setIsProfileOpen(true);
                }}
                className="text-sm text-muted-foreground"
              >
                {currentUsername}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="border-border hover:bg-secondary"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 container mx-auto px-4 py-6 flex flex-col max-w-4xl">
          <Card className="flex-1 flex flex-col bg-card border-border shadow-xl overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  username={message.profiles.username}
                  content={message.content}
                  imageUrl={message.image_url}
                  createdAt={message.created_at}
                  isCurrentUser={message.user_id === user.id}
                  onUsernameClick={(userId) => {
                    setSelectedUserId(userId);
                    setIsProfileOpen(true);
                  }}
                  userId={message.user_id}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            <TypingIndicator usernames={typingUsers} />

            <form onSubmit={sendMessage} className="p-4 border-t border-border bg-secondary">
              <div className="flex gap-2">
                {currentRoomId && (
                  <ImageUpload onImageUploaded={handleImageUpload} userId={user.id} />
                )}
                <Input
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  placeholder="Type a message..."
                  className="flex-1 bg-card border-border"
                  maxLength={500}
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>

      {selectedUserId && (
        <UserProfile
          userId={selectedUserId}
          isOpen={isProfileOpen}
          onClose={() => {
            setIsProfileOpen(false);
            setSelectedUserId(null);
          }}
          isCurrentUser={selectedUserId === user.id}
        />
      )}

      {isAdmin && (
        <AdminDashboard isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
      )}
    </div>
  );
};

export default Index;
