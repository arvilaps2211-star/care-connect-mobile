import { useCallback, useRef, useState, useEffect } from "react";

export const useSOSAlarm = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startAlarm = useCallback(() => {
    if (isPlaying) return;

    try {
      // Create audio context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn("Web Audio API not supported");
        return;
      }

      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      // Create oscillator for siren effect
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = "sine";
      gainNode.gain.value = 0.5;

      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;

      oscillator.start();
      setIsPlaying(true);

      // Create siren effect by alternating frequencies
      let highPitch = true;
      intervalRef.current = setInterval(() => {
        if (oscillatorRef.current) {
          oscillatorRef.current.frequency.setValueAtTime(
            highPitch ? 880 : 440, // A5 and A4
            audioContext.currentTime
          );
          highPitch = !highPitch;
        }
      }, 500); // Alternate every 500ms

      console.log("🔊 SOS Alarm started");
    } catch (error) {
      console.error("Failed to start alarm:", error);
    }
  }, [isPlaying]);

  const stopAlarm = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      oscillatorRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // Already closed
      }
      audioContextRef.current = null;
    }

    gainNodeRef.current = null;
    setIsPlaying(false);
    console.log("🔇 SOS Alarm stopped");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAlarm();
    };
  }, [stopAlarm]);

  return {
    isPlaying,
    startAlarm,
    stopAlarm,
  };
};
