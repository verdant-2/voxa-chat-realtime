import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";

interface ImageUploadProps {
  onImageUploaded: (url: string) => void;
  userId: string;
}

const ImageUpload = ({ onImageUploaded, userId }: ImageUploadProps) => {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploading(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${Math.random()}.${fileExt}`;

    const { error: uploadError, data } = await supabase.storage
      .from("chat-images")
      .upload(fileName, file);

    if (uploadError) {
      toast.error("Failed to upload image");
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("chat-images")
      .getPublicUrl(fileName);

    onImageUploaded(publicUrl);
    setUploading(false);
    toast.success("Image uploaded!");
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        disabled={uploading}
        className="hidden"
        id="image-upload"
      />
      <label htmlFor="image-upload">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={uploading}
          className="cursor-pointer"
          asChild
        >
          <span>
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImagePlus className="w-4 h-4" />
            )}
          </span>
        </Button>
      </label>
    </div>
  );
};

export default ImageUpload;
