import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCallback } from "react";

export const useDropWarning = () => {
  const { toast } = useToast();

  const showDropWarning = useCallback(() => {
    toast({
      title: "⚠️ Phone Drop Detected",
      description: "A sudden impact was detected. Are you okay? If you need help, use the emergency button.",
      duration: 5000,
      className: "bg-yellow-500/90 border-yellow-600 text-white",
    });
  }, [toast]);

  return { showDropWarning };
};
