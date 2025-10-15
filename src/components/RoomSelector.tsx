import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Hash, Lock } from "lucide-react";

interface Room {
  id: string;
  name: string;
  is_private: boolean;
  code: string | null;
}

interface RoomSelectorProps {
  currentRoomId: string | null;
  onRoomChange: (roomId: string | null) => void;
  userId: string;
}

const RoomSelector = ({ currentRoomId, onRoomChange, userId }: RoomSelectorProps) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    const { data: memberData } = await supabase
      .from("room_members")
      .select("room_id")
      .eq("user_id", userId);

    const roomIds = memberData?.map(m => m.room_id) || [];
    
    const { data: roomsData } = await supabase
      .from("rooms")
      .select("*")
      .in("id", roomIds);

    if (roomsData) {
      setRooms(roomsData);
    }
  };

  const createRoom = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const { data: room, error } = await supabase
      .from("rooms")
      .insert({
        name: roomName,
        is_private: true,
        code: code,
        created_by: userId
      })
      .select()
      .single();

    if (error || !room) {
      toast.error("Failed to create room");
      return;
    }

    await supabase.from("room_members").insert({
      room_id: room.id,
      user_id: userId
    });

    toast.success(`Room created! Code: ${code}`);
    setRoomCode(code);
    setRoomName("");
    fetchRooms();
  };

  const joinRoom = async () => {
    const { data: room } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", joinCode.toUpperCase())
      .single();

    if (!room) {
      toast.error("Invalid room code");
      return;
    }

    const { error } = await supabase.from("room_members").insert({
      room_id: room.id,
      user_id: userId
    });

    if (error) {
      toast.error("Failed to join room");
      return;
    }

    toast.success(`Joined ${room.name}!`);
    setJoinCode("");
    setIsJoinOpen(false);
    fetchRooms();
    onRoomChange(room.id);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">
              <Plus className="w-4 h-4 mr-2" />
              Create Room
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Create Private Room</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Room Name</Label>
                <Input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="My Private Room"
                  className="bg-secondary border-border"
                />
              </div>
              {roomCode && (
                <div className="p-3 bg-primary/10 rounded-md">
                  <p className="text-sm text-muted-foreground">Room Code:</p>
                  <p className="text-lg font-bold text-primary">{roomCode}</p>
                </div>
              )}
              <Button onClick={createRoom} disabled={!roomName.trim()} className="w-full">
                Create Room
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">
              <Hash className="w-4 h-4 mr-2" />
              Join Room
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Join Private Room</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Room Code</Label>
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Enter 6-character code"
                  className="bg-secondary border-border uppercase"
                  maxLength={6}
                />
              </div>
              <Button onClick={joinRoom} disabled={joinCode.length !== 6} className="w-full">
                Join Room
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Button
        variant={currentRoomId === null ? "default" : "ghost"}
        size="sm"
        onClick={() => onRoomChange(null)}
        className="w-full justify-start"
      >
        <Hash className="w-4 h-4 mr-2" />
        Global Room
      </Button>

      {rooms.map((room) => (
        <Button
          key={room.id}
          variant={currentRoomId === room.id ? "default" : "ghost"}
          size="sm"
          onClick={() => onRoomChange(room.id)}
          className="w-full justify-start"
        >
          {room.is_private ? (
            <Lock className="w-4 h-4 mr-2" />
          ) : (
            <Hash className="w-4 h-4 mr-2" />
          )}
          {room.name}
        </Button>
      ))}
    </div>
  );
};

export default RoomSelector;
