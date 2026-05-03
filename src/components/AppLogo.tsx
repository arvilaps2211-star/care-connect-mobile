import React from "react";

interface AppLogoProps {
  className?: string;
  alt?: string;
}

/**
 * Shared CareConnect logo. Sourced from /public/logo.png.
 * Default size is good for forms; pass className for headers (e.g. "h-8 w-8").
 */
const AppLogo: React.FC<AppLogoProps> = ({ className = "w-20 h-20 mx-auto", alt = "CareConnect" }) => (
  <img src="/logo.png" alt={alt} className={className} width={512} height={512} />
);

export default AppLogo;