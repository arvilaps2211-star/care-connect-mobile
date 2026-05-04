import React from "react";

interface AppLogoProps {
  className?: string;
  alt?: string;
  variant?: "user" | "ambulance";
}

/**
 * Shared CareConnect logo. Sourced from /public/logo.png.
 * Default size is good for forms; pass className for headers (e.g. "h-8 w-8").
 */
const AppLogo: React.FC<AppLogoProps> = ({ className = "w-20 h-20 mx-auto", alt = "CareConnect", variant }) => {
  const isAmbulance = variant === "ambulance" || (variant === undefined && import.meta.env.VITE_APP_TYPE === "ambulance");
  const src = isAmbulance ? "/logo-ambulance.png" : "/logo.png";
  return <img src={src} alt={alt} className={className} width={512} height={512} />;
};

export default AppLogo;