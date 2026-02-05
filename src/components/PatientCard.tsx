/**
 * Patient Card Component
 * Displays patient information with profile photo for hospital dashboard
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { User, Phone, Heart, MapPin, Clock, Users } from "lucide-react";

interface Guardian {
  name: string;
  relationship: string;
  contact_number: string;
}

interface PatientCardProps {
  name: string;
  phone: string;
  age?: number;
  gender?: string;
  address?: string;
  profilePhotoUrl?: string | null;
  bloodGroup?: string;
  medicalHistory?: string;
  guardians?: Guardian[];
  emergencyTime?: string;
  compact?: boolean;
}

export const PatientCard = ({
  name,
  phone,
  age,
  gender,
  address,
  profilePhotoUrl,
  bloodGroup,
  medicalHistory,
  guardians,
  emergencyTime,
  compact = false,
}: PatientCardProps) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 border">
          <AvatarImage src={profilePhotoUrl || undefined} alt={name} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{name}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {age && <span>{age}y</span>}
            {gender && <span className="capitalize">{gender}</span>}
            {bloodGroup && (
              <Badge variant="outline" className="text-xs">
                {bloodGroup}
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header with photo */}
        <div className="flex items-start gap-4 mb-4">
          <Avatar className="h-16 w-16 border-2 border-primary">
            <AvatarImage src={profilePhotoUrl || undefined} alt={name} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>{phone}</span>
            </div>
            {emergencyTime && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Clock className="h-3 w-3" />
                <span>SOS at {formatTime(emergencyTime)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Patient details */}
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            {age && (
              <Badge variant="secondary">
                <User className="h-3 w-3 mr-1" />
                {age} years
              </Badge>
            )}
            {gender && (
              <Badge variant="secondary" className="capitalize">
                {gender}
              </Badge>
            )}
            {bloodGroup && (
              <Badge variant="destructive">
                <Heart className="h-3 w-3 mr-1" />
                {bloodGroup}
              </Badge>
            )}
          </div>

          {address && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{address}</span>
            </div>
          )}

          {medicalHistory && (
            <div className="bg-muted/50 rounded-md p-2 mt-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Medical History
              </p>
              <p className="text-sm line-clamp-3">{medicalHistory}</p>
            </div>
          )}

          {/* Guardian contacts */}
          {guardians && guardians.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Users className="h-3 w-3" />
                Emergency Contacts ({guardians.length})
              </p>
              <div className="space-y-1">
                {guardians.slice(0, 2).map((g, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {g.name} ({g.relationship})
                    </span>
                    <a
                      href={`tel:${g.contact_number}`}
                      className="text-primary hover:underline"
                    >
                      {g.contact_number}
                    </a>
                  </div>
                ))}
                {guardians.length > 2 && (
                  <p className="text-xs text-muted-foreground">
                    +{guardians.length - 2} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PatientCard;
