/**
 * Profile Image Capture Component
 * Mobile-only camera/gallery capture with compression
 * Falls back gracefully on web
 */

import { useState } from "react";
import { Camera, CameraResultType, CameraSource, Photo } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera as CameraIcon, Image, User, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProfileImageCaptureProps {
  userId: string;
  currentImageUrl?: string | null;
  userName?: string;
  onImageUpdated: (url: string) => void;
}

export const ProfileImageCapture = ({
  userId,
  currentImageUrl,
  userName,
  onImageUpdated,
}: ProfileImageCaptureProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const isNative = Capacitor.isNativePlatform();

  /**
   * Capture image from camera or gallery
   */
  const captureImage = async (source: CameraSource) => {
    try {
      console.log("[ProfileImage] Capturing from:", source);

      // Request permissions first on native
      if (isNative) {
        const permissions = await Camera.checkPermissions();
        if (permissions.camera !== "granted" || permissions.photos !== "granted") {
          const request = await Camera.requestPermissions();
          if (request.camera !== "granted" && source === CameraSource.Camera) {
            toast({
              title: "Camera Permission Required",
              description: "Please enable camera access in your device settings.",
              variant: "destructive",
            });
            return;
          }
        }
      }

      const photo: Photo = await Camera.getPhoto({
        quality: 70, // Compress to 70% quality
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source,
        width: 400, // Max width for profile photos
        height: 400, // Max height
      });

      if (!photo.base64String) {
        throw new Error("No image data captured");
      }

      // Create preview
      const mimeType = photo.format === "png" ? "image/png" : "image/jpeg";
      const preview = `data:${mimeType};base64,${photo.base64String}`;
      setPreviewUrl(preview);

      // Upload to storage
      await uploadImage(photo.base64String, photo.format || "jpeg");
    } catch (error: any) {
      console.error("[ProfileImage] Capture error:", error);
      
      // User cancelled - not an error
      if (error?.message?.includes("cancelled") || error?.message?.includes("canceled")) {
        return;
      }

      toast({
        title: "Capture Failed",
        description: error?.message || "Could not capture image",
        variant: "destructive",
      });
    }
  };

  /**
   * Upload image to Supabase storage
   */
  const uploadImage = async (base64Data: string, format: string) => {
    setIsUploading(true);

    try {
      console.log("[ProfileImage] Uploading to storage...");

      // Convert base64 to blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const mimeType = format === "png" ? "image/png" : "image/jpeg";
      const blob = new Blob([byteArray], { type: mimeType });

      // Generate unique filename - folder must be userId for RLS policy
      const fileName = `profile-${Date.now()}.${format}`;
      const filePath = `${userId}/${fileName}`;

      // Upload to profile-photos bucket
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(filePath, blob, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(filePath);

      const imageUrl = publicUrl.publicUrl;
      console.log("[ProfileImage] Upload successful:", imageUrl);

      // Update profile in database
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          profile_photo_url: imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        throw updateError;
      }

      // Notify parent
      onImageUpdated(imageUrl);

      toast({
        title: "Photo Updated",
        description: "Your profile photo has been saved.",
      });

      setIsOpen(false);
    } catch (error: any) {
      console.error("[ProfileImage] Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error?.message || "Could not save photo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Handle web file input fallback
   */
  const handleWebFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image under 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);

      // Generate unique filename
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${userId}-${Date.now()}.${ext}`;
      const filePath = `profiles/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(filePath);

      const imageUrl = publicUrl.publicUrl;

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          profile_photo_url: imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      onImageUpdated(imageUrl);
      toast({ title: "Photo Updated" });
      setIsOpen(false);
    } catch (error: any) {
      console.error("[ProfileImage] Web upload error:", error);
      toast({
        title: "Upload Failed",
        description: error?.message || "Could not save photo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative group cursor-pointer"
        aria-label="Change profile photo"
      >
        <Avatar className="w-20 h-20 border-2 border-primary">
          <AvatarImage src={currentImageUrl || undefined} alt={userName || "Profile"} />
          <AvatarFallback className="text-lg bg-primary/10">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <CameraIcon className="w-6 h-6 text-white" />
        </div>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Profile Photo</DialogTitle>
          </DialogHeader>

          {/* Preview */}
          <div className="flex justify-center py-4">
            <Avatar className="w-32 h-32 border-2">
              <AvatarImage src={previewUrl || currentImageUrl || undefined} />
              <AvatarFallback className="text-2xl">
                <User className="w-12 h-12 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
          </div>

          {isUploading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Uploading...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {isNative ? (
                <>
                  <Button
                    className="w-full"
                    onClick={() => captureImage(CameraSource.Camera)}
                  >
                    <CameraIcon className="w-4 h-4 mr-2" />
                    Take Photo
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => captureImage(CameraSource.Photos)}
                  >
                    <Image className="w-4 h-4 mr-2" />
                    Choose from Gallery
                  </Button>
                </>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleWebFileInput}
                    className="hidden"
                    id="profile-photo-input"
                  />
                  <label htmlFor="profile-photo-input">
                    <Button asChild className="w-full cursor-pointer">
                      <span>
                        <Image className="w-4 h-4 mr-2" />
                        Choose Photo
                      </span>
                    </Button>
                  </label>
                </div>
              )}

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProfileImageCapture;
