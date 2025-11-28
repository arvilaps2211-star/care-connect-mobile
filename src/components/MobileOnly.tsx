import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, AlertTriangle } from "lucide-react";

const MobileOnly = ({ children }: { children: React.ReactNode }) => {
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isSmallScreen = window.innerWidth <= 768;
      
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  if (!isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-emergency/10 flex items-center justify-center p-4">
        <Card className="max-w-md shadow-glow border-2 border-primary">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="bg-gradient-emergency p-6 rounded-full">
                <Smartphone className="w-12 h-12 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">Mobile App Only</CardTitle>
            <CardDescription className="text-base">
              CareConnect is designed exclusively for mobile devices to provide emergency response services.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-emergency mt-0.5" />
                <div>
                  <p className="font-semibold">How to Access:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 mt-2">
                    <li>• Open this app on your mobile device</li>
                    <li>• Download from the App Store or Play Store (coming soon)</li>
                    <li>• Scan the QR code with your phone camera</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              This app requires mobile sensors like accelerometer and GPS for accident detection and emergency response.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default MobileOnly;
