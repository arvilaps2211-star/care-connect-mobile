/**
 * useEmergency Hook
 * Provides a reusable interface to trigger emergencies with loading/error state
 */

import { useState, useCallback } from "react";
import { triggerEmergency, type EmergencyTriggerParams, type EmergencyResult } from "../services/emergencyService";

export function useEmergency() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<EmergencyResult | null>(null);

  const trigger = useCallback(async (params: EmergencyTriggerParams): Promise<EmergencyResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await triggerEmergency(params);
      setLastResult(result);

      if (result.error) {
        setError(result.error);
      }

      return result;
    } catch (err: any) {
      const msg = err?.message ?? "Emergency trigger failed";
      setError(msg);
      const failResult: EmergencyResult = {
        emergencyId: "",
        location: null,
        smsResult: null,
        pushSent: false,
        error: msg,
      };
      setLastResult(failResult);
      return failResult;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLastResult(null);
  }, []);

  return {
    trigger,
    isLoading,
    error,
    lastResult,
    reset,
  };
}
