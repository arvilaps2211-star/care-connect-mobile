/**
 * SMS Status Badge Component
 * Displays SMS delivery status with appropriate styling
 */

import { Badge } from "@/components/ui/badge";
import { SMSStatus, getSMSStatusLabel, getSMSStatusVariant } from "@/utils/smsService";
import { MessageSquare, AlertCircle, CheckCircle, Clock, Settings, Wrench } from "lucide-react";

interface SMSStatusBadgeProps {
  status: SMSStatus;
  showIcon?: boolean;
  className?: string;
}

const StatusIcon = ({ status }: { status: SMSStatus }) => {
  const iconClass = "w-3 h-3 mr-1";
  
  switch (status) {
    case "sent":
      return <CheckCircle className={iconClass} />;
    case "partial":
      return <AlertCircle className={iconClass} />;
    case "failed":
      return <AlertCircle className={iconClass} />;
    case "not_configured":
      return <Settings className={iconClass} />;
    case "simulated":
      return <Wrench className={iconClass} />;
    case "pending":
    default:
      return <Clock className={iconClass} />;
  }
};

export const SMSStatusBadge = ({ status, showIcon = true, className = "" }: SMSStatusBadgeProps) => {
  const variant = getSMSStatusVariant(status);
  const label = getSMSStatusLabel(status);
  
  return (
    <Badge variant={variant} className={`text-xs ${className}`}>
      {showIcon && <StatusIcon status={status} />}
      {label}
    </Badge>
  );
};

/**
 * SMS Notification Summary Component
 * Shows detailed SMS delivery information
 */
interface SMSNotificationSummaryProps {
  guardianNotified: boolean | null;
  notifiedAt: string | null;
  className?: string;
}

export const SMSNotificationSummary = ({ 
  guardianNotified, 
  notifiedAt, 
  className = "" 
}: SMSNotificationSummaryProps) => {
  const status: SMSStatus = guardianNotified === true 
    ? "sent" 
    : guardianNotified === false 
      ? "failed" 
      : "pending";
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <MessageSquare className="w-4 h-4 text-muted-foreground" />
      <div className="flex flex-col">
        <SMSStatusBadge status={status} />
        {notifiedAt && (
          <span className="text-xs text-muted-foreground mt-0.5">
            {new Date(notifiedAt).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
};

export default SMSStatusBadge;
