import { useAccidentDetection } from "@/hooks/useAccidentDetection";
import { useDropWarning } from "@/components/DropWarningToast";

interface AccelerometerMonitorProps {
  onAccidentDetected: () => void;
  onDropDetected?: () => void;
}

const AccelerometerMonitor = ({ 
  onAccidentDetected, 
  onDropDetected 
}: AccelerometerMonitorProps) => {
  const { showDropWarning } = useDropWarning();

  const { isActive, lastGForce } = useAccidentDetection({
    enabled: true,
    onDrop: () => {
      // Show warning toast for phone drops
      showDropWarning();
      // Also call optional callback
      onDropDetected?.();
    },
    onAccident: () => {
      // Trigger full emergency flow for high impacts
      onAccidentDetected();
    },
    cooldownMs: 10000, // 10 second cooldown
  });

  // This is a background monitor - no UI
  return null;
};

export default AccelerometerMonitor;
