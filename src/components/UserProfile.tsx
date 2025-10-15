import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User } from "lucide-react";

interface UserProfileProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  isCurrentUser: boolean;
}

interface Profile {
  username: string;
  bio: string | null;
  avatar_url: string | null;
}

const UserProfile = ({ userId, isOpen, onClose, isCurrentUser }: UserProfileProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      fetchProfile();
    }
  }, [isOpen, userId]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("username, bio, avatar_url")
      .eq("id", userId)
      .single();

    if (error) {
      toast.error("Failed to load profile");
      return;
    }

    if (data) {
      setProfile(data);
      setBio(data.bio || "");
      setUsername(data.username);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ bio, username })
      .eq("id", userId);

    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated!");
      setIsEditing(false);
      fetchProfile();
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">User Profile</DialogTitle>
        </DialogHeader>
        
        {profile && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                {isEditing ? (
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="font-semibold"
                  />
                ) : (
                  <h3 className="font-semibold text-lg text-foreground">{profile.username}</h3>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Bio</Label>
              {isEditing ? (
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="bg-secondary border-border text-foreground"
                  rows={4}
                />
              ) : (
                <p className="text-muted-foreground p-3 bg-secondary rounded-md min-h-[100px]">
                  {profile.bio || "No bio yet"}
                </p>
              )}
            </div>

            {isCurrentUser && (
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button onClick={handleSave} disabled={loading} className="flex-1">
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setBio(profile.bio || "");
                        setUsername(profile.username);
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsEditing(true)} className="w-full">
                    Edit Profile
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserProfile;
