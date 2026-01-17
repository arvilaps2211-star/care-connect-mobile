import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface SOSContextType {
  showSOS: boolean;
  triggerSOS: () => void;
  dismissSOS: () => void;
  onEmergencyConfirmed: ((location: { latitude: number; longitude: number }) => Promise<void>) | null;
  setEmergencyHandler: (handler: (location: { latitude: number; longitude: number }) => Promise<void>) => void;
}

const SOSContext = createContext<SOSContextType | null>(null);

export const useSOSContext = () => {
  const context = useContext(SOSContext);
  if (!context) {
    throw new Error("useSOSContext must be used within SOSProvider");
  }
  return context;
};

interface SOSProviderProps {
  children: ReactNode;
}

export const SOSProvider = ({ children }: SOSProviderProps) => {
  const [showSOS, setShowSOS] = useState(false);
  const [emergencyHandler, setEmergencyHandlerState] = useState<((location: { latitude: number; longitude: number }) => Promise<void>) | null>(null);

  const triggerSOS = useCallback(() => {
    setShowSOS(true);
  }, []);

  const dismissSOS = useCallback(() => {
    setShowSOS(false);
  }, []);

  const setEmergencyHandler = useCallback((handler: (location: { latitude: number; longitude: number }) => Promise<void>) => {
    setEmergencyHandlerState(() => handler);
  }, []);

  return (
    <SOSContext.Provider
      value={{
        showSOS,
        triggerSOS,
        dismissSOS,
        onEmergencyConfirmed: emergencyHandler,
        setEmergencyHandler,
      }}
    >
      {children}
    </SOSContext.Provider>
  );
};
