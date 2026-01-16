import { Capacitor } from '@capacitor/core';

/**
 * Check if the app is running as a native mobile app
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Check if the app is running on Android
 */
export const isAndroid = (): boolean => {
  return Capacitor.getPlatform() === 'android';
};

/**
 * Check if the app is running on iOS
 */
export const isIOS = (): boolean => {
  return Capacitor.getPlatform() === 'ios';
};

/**
 * Check if the app is running on web
 */
export const isWeb = (): boolean => {
  return Capacitor.getPlatform() === 'web';
};

/**
 * Get the current platform
 */
export const getPlatform = (): string => {
  return Capacitor.getPlatform();
};
