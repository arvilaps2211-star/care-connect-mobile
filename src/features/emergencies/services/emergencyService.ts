/**
 * Centralized Emergency Service
 * Orchestrates the full SOS flow: GPS → DB → SMS → Notifications
 */

import { supabase } from "@/integrations/supabase/client";
import { getEmergencyLocation } from "@/utils/emergencyGPS";
import { sendEmergencySMS, type SMSSendResponse } from "@/utils/smsService";
import { showEmergencyNotification } from "@/utils/backgroundNotification";

export interface EmergencyTriggerParams {
  userId: string;
  userName: string;
  userPhone: string;
  userAge?: number;
  userGender?: string;
  vehicleNumber?: string;
  bloodGroup?: string;
  medicalHistory?: string;
  profilePhotoUrl?: string;
  residentialAddress?: string;
  /** Pre-acquired location (from EmergencyModal) */
  location?: { latitude: number; longitude: number };
  /** Cached fallback if live GPS fails */
  fallbackLocation?: { latitude: number; longitude: number } | null;
}

export interface EmergencyResult {
  emergencyId: string;
  location: { latitude: number; longitude: number } | null;
  smsResult: SMSSendResponse | null;
  pushSent: boolean;
  error?: string;
}

/**
 * Full emergency trigger flow:
 * 1. Resolve GPS location (use provided or fetch fresh)
 * 2. Create emergency record in Supabase
 * 3. Fetch guardians
 * 4. Send SMS to all guardians (async, non-blocking)
 * 5. Push notification to hospitals/ambulances
 * 6. Show local emergency notification
 */
export async function triggerEmergency(params: EmergencyTriggerParams): Promise<EmergencyResult> {
  console.log("[EmergencyService] Starting emergency flow for user:", params.userId);

  // 1. Resolve location
  let resolvedLocation = params.location ?? null;
  if (!resolvedLocation || (resolvedLocation.latitude === 0 && resolvedLocation.longitude === 0)) {
    console.log("[EmergencyService] No pre-acquired location, fetching GPS...");
    const emergencyLoc = await getEmergencyLocation(params.fallbackLocation);
    if (emergencyLoc.source !== "unavailable") {
      resolvedLocation = { latitude: emergencyLoc.latitude, longitude: emergencyLoc.longitude };
    }
  }

  // 2. Create emergency record
  console.log("[EmergencyService] Creating emergency record...");
  const { data: emergency, error: dbError } = await supabase
    .from("emergencies")
    .insert({
      user_id: params.userId,
      latitude: resolvedLocation?.latitude ?? null,
      longitude: resolvedLocation?.longitude ?? null,
      status: "active",
    })
    .select()
    .single();

  if (dbError || !emergency) {
    console.error("[EmergencyService] DB insert failed:", dbError);
    return {
      emergencyId: "",
      location: resolvedLocation,
      smsResult: null,
      pushSent: false,
      error: dbError?.message ?? "Failed to create emergency record",
    };
  }

  console.log("[EmergencyService] Emergency created:", emergency.id);

  // 3. Fetch guardians
  const { data: guardians } = await supabase
    .from("guardians")
    .select("name, contact_number")
    .eq("user_id", params.userId);

  const guardianList = (guardians ?? []).map((g) => ({
    name: g.name,
    phone: g.contact_number,
  }));

  // 4. Send SMS (non-blocking)
  let smsResult: SMSSendResponse | null = null;
  if (guardianList.length > 0) {
    console.log("[EmergencyService] Sending SMS to", guardianList.length, "guardian(s)");
    smsResult = await sendEmergencySMS({
      emergencyId: emergency.id,
      userPhone: params.userPhone,
      userName: params.userName,
      location: resolvedLocation,
      locationSource: resolvedLocation ? "gps" : "unavailable",
      guardians: guardianList,
      userAge: params.userAge,
      userGender: params.userGender,
      vehicleNumber: params.vehicleNumber,
      bloodGroup: params.bloodGroup,
      medicalHistory: params.medicalHistory,
      profilePhotoUrl: params.profilePhotoUrl,
      residentialAddress: params.residentialAddress,
    });
  } else {
    console.log("[EmergencyService] No guardians configured");
  }

  // 5. Push notification to hospitals/ambulances
  let pushSent = false;
  try {
    await supabase.functions.invoke("send-push-notification", {
      body: {
        emergencyId: emergency.id,
        title: "🚨 EMERGENCY ALERT",
        body: `Emergency reported by ${params.userName}${
          resolvedLocation
            ? `. Location: ${resolvedLocation.latitude.toFixed(4)}, ${resolvedLocation.longitude.toFixed(4)}`
            : ""
        }`,
        data: {
          type: "emergency",
          lat: String(resolvedLocation?.latitude ?? ""),
          lng: String(resolvedLocation?.longitude ?? ""),
        },
        targetRoles: ["hospital", "ambulance"],
      },
    });
    pushSent = true;
    console.log("[EmergencyService] Push notifications sent");
  } catch (pushErr) {
    console.error("[EmergencyService] Push notification error:", pushErr);
  }

  // 6. Show local emergency notification
  try {
    await showEmergencyNotification();
  } catch (e) {
    console.warn("[EmergencyService] Local notification failed:", e);
  }

  return {
    emergencyId: emergency.id,
    location: resolvedLocation,
    smsResult,
    pushSent,
  };
}
