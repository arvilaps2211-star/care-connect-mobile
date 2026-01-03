import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

const SplashScreen = ({ onComplete, minDuration = 2000 }: SplashScreenProps) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onComplete, 500); // Wait for exit animation
    }, minDuration);

    return () => clearTimeout(timer);
  }, [onComplete, minDuration]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-red-600 via-red-500 to-orange-500 transition-opacity duration-500 ${
        isExiting ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Animated Logo */}
      <div className="relative">
        {/* Pulse rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute w-32 h-32 rounded-full bg-white/20 animate-ping" style={{ animationDuration: "1.5s" }} />
          <div className="absolute w-40 h-40 rounded-full bg-white/10 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.3s" }} />
        </div>
        
        {/* Main logo */}
        <div 
          className={`relative bg-white p-6 rounded-3xl shadow-2xl transform transition-all duration-700 ${
            isExiting ? "scale-150 opacity-0" : "scale-100 opacity-100"
          }`}
          style={{
            animation: !isExiting ? "splash-bounce 0.8s ease-out" : undefined,
          }}
        >
          <Heart className="w-16 h-16 text-red-500 animate-pulse" />
        </div>
      </div>

      {/* App name with staggered animation */}
      <div className="mt-8 text-center">
        <h1 
          className={`text-5xl font-bold text-white transform transition-all duration-500 delay-300 ${
            isExiting ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
          }`}
          style={{
            animation: !isExiting ? "splash-fade-up 0.6s ease-out 0.3s both" : undefined,
          }}
        >
          CareConnect
        </h1>
        <p 
          className={`mt-3 text-white/80 text-lg transform transition-all duration-500 delay-500 ${
            isExiting ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
          }`}
          style={{
            animation: !isExiting ? "splash-fade-up 0.6s ease-out 0.5s both" : undefined,
          }}
        >
          Your Personal Emergency Response
        </p>
      </div>

      {/* Loading indicator */}
      <div 
        className={`mt-12 flex gap-2 transform transition-all duration-500 delay-700 ${
          isExiting ? "opacity-0" : "opacity-100"
        }`}
        style={{
          animation: !isExiting ? "splash-fade-up 0.6s ease-out 0.7s both" : undefined,
        }}
      >
        <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0s" }} />
        <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0.1s" }} />
        <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0.2s" }} />
      </div>

      {/* Custom keyframes */}
      <style>{`
        @keyframes splash-bounce {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes splash-fade-up {
          0% {
            transform: translateY(20px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
