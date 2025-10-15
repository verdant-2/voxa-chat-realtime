import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, Users, MessageSquare, Trash2, Volume2, VolumeX } from "lucide-react";

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface User {
  id: string;
  username: string;
  created_at: string;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  profiles: { username: string };
  rooms: { name: string } | null;
}

const AdminDashboard = ({ isOpen, onClose }: AdminDashboardProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      fetchAllMessages();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, created_at")
      .order("created_at", { ascending: false });
    
    if (data) setUsers(data);
  };

  const fetchAllMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select(`
        id,
        content,
        created_at,
        profiles (username),
        rooms (name)
      `)
      .order("created_at", { ascending: false })
      .limit(100);
    
    if (data) setMessages(data as any);
  };

  const deleteUser = async (userId: string) => {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    
    if (error) {
      toast.error("Failed to delete user");
    } else {
      toast.success("User deleted");
      fetchUsers();
    }
  };

  const muteUser = async (userId: string) => {
    const { error } = await supabase
      .from("muted_users")
      .insert({ user_id: userId, muted_by: (await supabase.auth.getUser()).data.user?.id });
    
    if (error) {
      toast.error("Failed to mute user");
    } else {
      toast.success("User muted");
    }
  };

  const unmuteUser = async (userId: string) => {
    const { error } = await supabase
      .from("muted_users")
      .delete()
      .eq("user_id", userId);
    
    if (error) {
      toast.error("Failed to unmute user");
    } else {
      toast.success("User unmuted");
    }
  };

  const updateUsername = async () => {
    if (!selectedUserId || !newUsername.trim()) return;

    const { error } = await supabase
      .from("profiles")
      .update({ username: newUsername })
      .eq("id", selectedUserId);
    
    if (error) {
      toast.error("Failed to update username");
    } else {
      toast.success("Username updated");
      setNewUsername("");
      setSelectedUserId("");
      fetchUsers();
    }
  };

  const deleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId);
    
    if (error) {
      toast.error("Failed to delete message");
    } else {
      toast.success("Message deleted");
      fetchAllMessages();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Admin Dashboard
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="messages">
              <MessageSquare className="w-4 h-4 mr-2" />
              Messages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="space-y-2">
              <Label>Change Username</Label>
              <div className="flex gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-secondary border border-border rounded-md text-foreground"
                >
                  <option value="">Select user...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="New username"
                  className="flex-1"
                />
                <Button onClick={updateUsername} disabled={!selectedUserId || !newUsername.trim()}>
                  Update
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-secondary rounded-md">
                  <div>
                    <p className="font-semibold text-foreground">{user.username}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => muteUser(user.id)}
                    >
                      <VolumeX className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unmuteUser(user.id)}
                    >
                      <Volume2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteUser(user.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="messages" className="space-y-2">
            {messages.map((message) => (
              <div key={message.id} className="flex items-start justify-between p-3 bg-secondary rounded-md">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {message.profiles.username}
                    {message.rooms && (
                      <span className="text-xs text-muted-foreground ml-2">
                        in {message.rooms.name}
                      </span>
                    )}
                  </p>
                  <p className="text-foreground">{message.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMessage(message.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AdminDashboard;
