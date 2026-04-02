/**
 * SMS Feature Module
 * Re-exports all SMS-related services, utils, and components
 */

export {
  sendEmergencySMS,
  sendAmbulanceDispatchSMS,
  sendHospitalAcceptanceSMS,
  getSMSStatusLabel,
  getSMSStatusVariant,
} from "@/utils/smsService";
export type { SMSStatus, SMSResult, SMSSendResponse } from "@/utils/smsService";

export { validateAndFormatPhone } from "@/utils/phoneValidation";
export { wasSMSSentRecently, markSMSPending, markSMSSent, markSMSFailed } from "@/utils/smsQueue";
