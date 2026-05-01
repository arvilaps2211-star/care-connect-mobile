import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, History, MapPin } from "lucide-react";

interface TripRow {
  id: string;
  created_at: string;
  resolved_at: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  user_id: string;
}

interface TripHistoryProps {
  ambulanceId: string;
}

const TripHistory = ({ ambulanceId }: TripHistoryProps) => {
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !ambulanceId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("emergencies")
        .select("id, created_at, resolved_at, status, latitude, longitude, user_id")
        .eq("dispatched_to_ambulance", ambulanceId)
        .in("status", ["resolved", "completed"])
        .order("resolved_at", { ascending: false, nullsFirst: false })
        .limit(20);
      setTrips((data as TripRow[]) ?? []);
      setLoading(false);
    })();
  }, [open, ambulanceId]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Trip History
            {trips.length > 0 && (
              <Badge variant="secondary">{trips.length}</Badge>
            )}
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-2">
        {loading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {!loading && trips.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No completed trips yet.
          </p>
        )}
        {trips.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  Case #{t.id.slice(0, 8)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(t.resolved_at ?? t.created_at).toLocaleString()}
                </div>
              </div>
              <Badge variant="outline" className="capitalize">
                {t.status}
              </Badge>
              {t.latitude != null && t.longitude != null && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    window.open(
                      `https://maps.google.com/?q=${t.latitude},${t.longitude}`,
                      "_blank"
                    )
                  }
                >
                  <MapPin className="mr-1 h-3 w-3" />
                  Map
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default TripHistory;