import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, AlertTriangle, Hospital, Shield } from "lucide-react";

// Routes that should only work on mobile devices
const MOBILE_ONLY_ROUTES = ["/", "/auth", "/onboarding", "/dashboard", "/settings"];

// Routes that work on desktop (hospital/admin dashboards)
const DESKTOP_ALLOWED_ROUTES = ["/hospital", "/ambulance", "/admin"];

const MobileOnly = ({ children }: { children: React.ReactNode }) => {
  const [isMobile, setIsMobile] = useState(true);
  const location = useLocation();

  // DEVELOPMENT MODE: Bypass all restrictions when running `npm run dev`
  const isDevelopment = import.meta.env.DEV;
  
  // URL escape hatch: ?forceMobile=1 allows desktop access in any environment
  const forceMobile = new URLSearchParams(location.search).get("forceMobile") === "1";

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

  // Check if current route is desktop-allowed (hospital/admin routes work on desktop in production)
  const isDesktopAllowed = DESKTOP_ALLOWED_ROUTES.some((route) => location.pathname.startsWith(route));

  // BYPASS LOGIC:
  // 1. Development mode (`npm run dev`): ALL routes accessible on desktop
  // 2. Production with forceMobile=1 URL param: ALL routes accessible
  // 3. Production mobile device: ALL routes accessible
  // 4. Production desktop: Only DESKTOP_ALLOWED_ROUTES accessible
  if (isDevelopment || forceMobile || isMobile || isDesktopAllowed) {
    return <>{children}</>;
  }

  // Show mobile-only message for user routes on desktop
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-emergency/10 flex items-center justify-center p-4">
      <Card className="max-w-md shadow-glow border-2 border-primary">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-gradient-emergency p-6 rounded-full">
              <Smartphone className="w-12 h-12 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">CareConnect Mobile</CardTitle>
          <CardDescription className="text-base">
            User Emergency Response App - Mobile devices only
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-emergency mt-0.5" />
              <div>
                <p className="font-semibold">Mobile Device Required</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This app uses your phone's accelerometer & GPS for automatic accident detection.
                </p>
              </div>
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            Please open CareConnect Mobile on your smartphone for emergency detection and response.
          </div>
          <div className="border-t pt-4 space-y-3">
            <p className="text-center text-sm font-medium">
              Looking for CareConnect Hospitals?
            </p>
            <p className="text-center text-xs text-muted-foreground">
              Desktop application for hospital staff to receive and respond to emergencies
            </p>
            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link to="/hospital/login">
                  <Hospital className="mr-2 h-4 w-4" />
                  CareConnect Hospitals
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  Admin Panel
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MobileOnly;
