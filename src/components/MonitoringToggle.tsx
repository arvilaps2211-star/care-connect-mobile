/**
 * MonitoringToggle — Dashboard widget that controls background crash detection.
 *
 * Displays monitoring status with a pulsing indicator and provides
 * start/stop toggle + a dev-only "Simulate Crash" button.
 */

import { Shield, Activity, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrashDetection } from "@/hooks/useCrashDetection";

interface MonitoringToggleProps {
  /** Show the simulate crash button (dev/testing only) */
  showSimulate?: boolean;
}

const MonitoringToggle = ({ showSimulate = false }: MonitoringToggleProps) => {
  const { isMonitoring, toggleMonitoring, simulateCrash } = useCrashDetection();

  return (
    <Card className={`border-2 ${isMonitoring ? "border-primary shadow-glow" : "border-muted"}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className={`w-5 h-5 ${isMonitoring ? "text-primary" : "text-muted-foreground"}`} />
          Crash Detection
          {isMonitoring && (
            <span className="flex items-center gap-1 ml-auto text-xs font-normal text-primary">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Active
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {isMonitoring
            ? "Background monitoring is running. You'll be alerted if a crash is detected — even with your screen locked."
            : "Enable background crash detection to get emergency help automatically if an accident is detected."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={toggleMonitoring}
          size="lg"
          className={`w-full ${
            isMonitoring
              ? "bg-gradient-safe hover:opacity-90"
              : "bg-gradient-emergency hover:opacity-90"
          }`}
        >
          {isMonitoring ? (
            <>
              <Activity className="mr-2 w-5 h-5 animate-pulse" />
              Monitoring Active — Tap to Stop
            </>
          ) : (
            <>
              <Shield className="mr-2 w-5 h-5" />
              Start Monitoring
            </>
          )}
        </Button>

        {showSimulate && (
          <Button
            onClick={simulateCrash}
            variant="outline"
            size="sm"
            className="w-full text-xs"
          >
            <Zap className="mr-1 w-3 h-3" />
            Simulate Crash (Dev)
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default MonitoringToggle;
