import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  LogOut, Hospital, Ambulance, Trash2, Activity, Users, AlertTriangle, CheckCircle, BarChart3,
  Shield, Clock, MessageSquare, MapPin, RefreshCw, Search, Loader2, ExternalLink,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SMSStatusBadge } from "@/components/SMSStatusBadge";

interface Emergency {
  id: string;
  status: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string | null;
  notified_at: string | null;
  guardian_notified: boolean | null;
  accepted_by_hospital: string | null;
  dispatched_to_ambulance: string | null;
}
interface Place {
  id: string;
  name: string;
  contact_number: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string | null;
}
type StatKey = "totalEmergencies" | "activeEmergencies" | "resolvedEmergencies" | "totalHospitals" | "totalAmbulances" | "totalUsers";
type Stats = Record<StatKey, number | null>;

const EMERGENCY_LIMIT = 100;
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString() : "—");
const fmtCoord = (lat: number | null, lng: number | null) =>
  lat != null && lng != null ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : null;
const mapUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;

const TableSkeleton = () => (
  <div className="space-y-2 py-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
);
const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="text-center py-8 space-y-3">
    <p className="text-destructive text-sm">Couldn't load data: {message}</p>
    <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
  </div>
);

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stats, setStats] = useState<Stats>({
    totalEmergencies: null, activeEmergencies: null, resolvedEmergencies: null,
    totalHospitals: null, totalAmbulances: null, totalUsers: null,
  });
  const [statsWarning, setStatsWarning] = useState<string | null>(null);

  const [hospitals, setHospitals] = useState<Place[]>([]);
  const [ambulances, setAmbulances] = useState<Place[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState({ hospitals: true, ambulances: true, emergencies: true });
  const [errors, setErrors] = useState<{ hospitals?: string; ambulances?: string; emergencies?: string }>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [hospitalSearch, setHospitalSearch] = useState("");
  const [ambulanceSearch, setAmbulanceSearch] = useState("");
  const [emergencySearch, setEmergencySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const [pendingDelete, setPendingDelete] = useState<{ type: "hospital" | "ambulance"; item: Place } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState<"hospital" | "ambulance" | null>(null);

  const fetchStats = useCallback(async () => {
    const queries: [StatKey, any][] = [
      ["totalEmergencies", supabase.from("emergencies").select("id", { count: "exact", head: true })],
      ["activeEmergencies", supabase.from("emergencies").select("id", { count: "exact", head: true }).eq("status", "active")],
      ["resolvedEmergencies", supabase.from("emergencies").select("id", { count: "exact", head: true }).in("status", ["resolved", "closed"])],
      ["totalHospitals", supabase.from("hospitals").select("id", { count: "exact", head: true })],
      ["totalAmbulances", supabase.from("ambulance_services").select("id", { count: "exact", head: true })],
      ["totalUsers", supabase.from("profiles").select("id", { count: "exact", head: true })],
    ];
    const results = await Promise.allSettled(queries.map(([, q]) => q));
    const failed: string[] = [];
    setStats((prev) => {
      const next = { ...prev };
      results.forEach((r, i) => {
        const key = queries[i][0];
        if (r.status === "fulfilled" && !r.value.error) next[key] = r.value.count ?? 0;
        else failed.push(key);
      });
      return next;
    });
    setStatsWarning(failed.length ? "Some statistics couldn't be loaded and may be out of date." : null);
  }, []);

  const fetchPlaces = useCallback(async (kind: "hospitals" | "ambulances") => {
    setLoading((l) => ({ ...l, [kind]: true }));
    const table = kind === "hospitals" ? "hospitals" : "ambulance_services";
    try {
      const { data, error } = await supabase
        .from(table)
        .select("id, name, contact_number, latitude, longitude, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      (kind === "hospitals" ? setHospitals : setAmbulances)((data as Place[]) ?? []);
      setErrors((e) => ({ ...e, [kind]: undefined }));
    } catch (e: any) {
      setErrors((er) => ({ ...er, [kind]: e?.message || "Unknown error" }));
    } finally {
      setLoading((l) => ({ ...l, [kind]: false }));
    }
  }, []);

  const fetchEmergencies = useCallback(async () => {
    setLoading((l) => ({ ...l, emergencies: true }));
    try {
      // Privacy: no patient, medical or guardian fields
      const { data, error } = await supabase
        .from("emergencies")
        .select("id, status, latitude, longitude, created_at, notified_at, guardian_notified, accepted_by_hospital, dispatched_to_ambulance")
        .order("created_at", { ascending: false })
        .limit(EMERGENCY_LIMIT);
      if (error) throw error;
      setEmergencies((data as Emergency[]) ?? []);
      setErrors((e) => ({ ...e, emergencies: undefined }));
    } catch (e: any) {
      setErrors((er) => ({ ...er, emergencies: e?.message || "Unknown error" }));
    } finally {
      setLoading((l) => ({ ...l, emergencies: false }));
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([fetchStats(), fetchPlaces("hospitals"), fetchPlaces("ambulances"), fetchEmergencies()]);
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [fetchStats, fetchPlaces, fetchEmergencies]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const filterPlaces = (list: Place[], q: string) => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((p) => p.name?.toLowerCase().includes(s) || (p.contact_number ?? "").toLowerCase().includes(s));
  };
  const filteredHospitals = useMemo(() => filterPlaces(hospitals, hospitalSearch), [hospitals, hospitalSearch]);
  const filteredAmbulances = useMemo(() => filterPlaces(ambulances, ambulanceSearch), [ambulances, ambulanceSearch]);
  const filteredEmergencies = useMemo(() => {
    const s = emergencySearch.trim().toLowerCase();
    const list = emergencies.filter((e) => {
      if (statusFilter !== "all" && (e.status ?? "") !== statusFilter) return false;
      if (!s) return true;
      return (e.status ?? "").includes(s) || (fmtCoord(e.latitude, e.longitude) ?? "").includes(s) || fmtDate(e.created_at).toLowerCase().includes(s);
    });
    return list.sort((a, b) => {
      const d = new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
      return sortOrder === "newest" ? -d : d;
    });
  }, [emergencies, emergencySearch, statusFilter, sortOrder]);

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    const { type, item } = pendingDelete;
    const table = type === "hospital" ? "hospitals" : "ambulance_services";
    try {
      const { error } = await supabase.from(table).delete().eq("id", item.id);
      if (error) throw error;
      toast({ title: "Deleted", description: `${item.name} was removed.` });
      fetchPlaces(type === "hospital" ? "hospitals" : "ambulances");
      fetchStats();
    } catch (e: any) {
      const msg = /foreign key/i.test(e?.message ?? "")
        ? "This record is linked to other data (e.g. emergencies or fleet) and can't be deleted."
        : e?.message || "Delete failed";
      toast({ title: "Couldn't delete", description: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const handleCreate = (type: "hospital" | "ambulance") => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const get = (k: string) => String(fd.get(`${type}_${k}`) ?? "").trim();
    const payload = {
      type, email: get("email"), password: get("password"), name: get("name"),
      latitude: parseFloat(get("lat")), longitude: parseFloat(get("lng")), contact: get("contact"),
    };
    const err =
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ? "Enter a valid email." :
      payload.password.length < 6 ? "Password must be at least 6 characters." :
      !payload.name ? "Name is required." :
      isNaN(payload.latitude) || payload.latitude < -90 || payload.latitude > 90 ? "Latitude must be between -90 and 90." :
      isNaN(payload.longitude) || payload.longitude < -180 || payload.longitude > 180 ? "Longitude must be between -180 and 180." :
      payload.contact.replace(/\D/g, "").length < 10 ? "Enter a valid contact number." : null;
    if (err) { toast({ title: "Check the form", description: err, variant: "destructive" }); return; }

    setSubmitting(type);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-account", { body: payload });
      if (error || data?.error) {
        let msg = data?.error || error?.message;
        try { msg = (await (error as any)?.context?.json())?.error || msg; } catch { /* ignore */ }
        throw new Error(msg || "Creation failed");
      }
      toast({ title: "Created", description: `${payload.name} was added.` });
      form.reset();
      fetchPlaces(type === "hospital" ? "hospitals" : "ambulances");
      fetchStats();
    } catch (e: any) {
      toast({ title: "Couldn't create account", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin-login");
  };

  const statCards: { key: StatKey; label: string; icon: any; color: string }[] = [
    { key: "totalEmergencies", label: "Total Emergencies", icon: BarChart3, color: "text-blue-400" },
    { key: "activeEmergencies", label: "Active Now", icon: AlertTriangle, color: "text-red-400" },
    { key: "resolvedEmergencies", label: "Resolved", icon: CheckCircle, color: "text-green-400" },
    { key: "totalHospitals", label: "Hospitals", icon: Hospital, color: "text-purple-400" },
    { key: "totalAmbulances", label: "Ambulances", icon: Ambulance, color: "text-orange-400" },
    { key: "totalUsers", label: "Registered Users", icon: Users, color: "text-cyan-400" },
  ];

  const PlacesTable = ({ kind, list, all, search, setSearch }: {
    kind: "hospital" | "ambulance"; list: Place[]; all: Place[]; search: string; setSearch: (v: string) => void;
  }) => {
    const key = kind === "hospital" ? "hospitals" : "ambulances";
    const emptyText = kind === "hospital" ? "No hospitals registered yet." : "No ambulance services registered yet.";
    return (
      <>
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search by name or contact" value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-900/50 border-slate-600 text-white" />
        </div>
        {loading[key] ? <TableSkeleton /> : errors[key] ? (
          <ErrorState message={errors[key]!} onRetry={() => fetchPlaces(key)} />
        ) : all.length === 0 ? <p className="text-slate-500 text-center py-8">{emptyText}</p>
          : list.length === 0 ? <p className="text-slate-500 text-center py-8">No matches for "{search}".</p> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-300">{kind === "hospital" ? "Hospital" : "Service"}</TableHead>
                  <TableHead className="text-slate-300">Contact</TableHead>
                  <TableHead className="text-slate-300">Location</TableHead>
                  <TableHead className="text-slate-300">Registered</TableHead>
                  <TableHead className="text-slate-300 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((p) => {
                  const coord = fmtCoord(p.latitude, p.longitude);
                  return (
                    <TableRow key={p.id} className="border-slate-700">
                      <TableCell className="text-white font-medium">{p.name || "—"}</TableCell>
                      <TableCell className="text-slate-300">{p.contact_number || "—"}</TableCell>
                      <TableCell className="text-slate-400 font-mono text-xs">{coord ?? "—"}</TableCell>
                      <TableCell className="text-slate-400 text-xs">{fmtDate(p.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="destructive" size="sm" onClick={() => setPendingDelete({ type: kind, item: p })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </>
    );
  };

  const CreateForm = ({ type }: { type: "hospital" | "ambulance" }) => {
    const isH = type === "hospital";
    const busy = submitting === type;
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            {isH ? <Hospital className="h-5 w-5" /> : <Ambulance className="h-5 w-5" />}
            {isH ? "Add Hospital" : "Add Ambulance Service"}
          </CardTitle>
          <CardDescription className="text-slate-400">Creates a login account for this {isH ? "hospital" : "service"}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate(type)} className="space-y-4">
            <fieldset disabled={busy} className="space-y-4">
              <div><Label className="text-slate-300">Email</Label><Input name={`${type}_email`} type="email" required className="bg-slate-900/50 border-slate-600 text-white" /></div>
              <div><Label className="text-slate-300">Password</Label><Input name={`${type}_password`} type="password" minLength={6} required className="bg-slate-900/50 border-slate-600 text-white" /></div>
              <div><Label className="text-slate-300">{isH ? "Hospital Name" : "Service Name"}</Label><Input name={`${type}_name`} required className="bg-slate-900/50 border-slate-600 text-white" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-slate-300">Latitude</Label><Input name={`${type}_lat`} type="number" step="any" min={-90} max={90} required className="bg-slate-900/50 border-slate-600 text-white" /></div>
                <div><Label className="text-slate-300">Longitude</Label><Input name={`${type}_lng`} type="number" step="any" min={-180} max={180} required className="bg-slate-900/50 border-slate-600 text-white" /></div>
              </div>
              <div><Label className="text-slate-300">Contact Number</Label><Input name={`${type}_contact`} type="tel" required className="bg-slate-900/50 border-slate-600 text-white" /></div>
            </fieldset>
            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {busy ? "Creating..." : isH ? "Add Hospital" : "Add Ambulance"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-x-hidden">
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="CareConnect" className="h-10 w-10" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Admin Panel</h1>
              <p className="text-slate-400 text-xs">
                {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : "Loading..."}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshAll} disabled={refreshing} className="border-slate-600 text-slate-300 hover:bg-slate-700">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh
            </Button>
            <Button variant="outline" onClick={handleLogout} className="border-slate-600 text-slate-300 hover:bg-slate-700">
              <LogOut className="mr-2 h-4 w-4" />Logout
            </Button>
          </div>
        </div>

        <Card className="mb-6 bg-amber-900/20 border-amber-500/30">
          <CardContent className="py-4 flex items-center gap-3">
            <Shield className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-amber-200 text-sm">
              <strong>Privacy Notice:</strong> Patient medical details and guardian contact information are not shown in this panel.
            </p>
          </CardContent>
        </Card>

        {statsWarning && (
          <p className="mb-4 text-amber-300 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{statsWarning}</p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {statCards.map(({ key, label, icon: Icon, color }) => (
            <Card key={key} className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <Icon className={`w-8 h-8 ${color} mx-auto mb-2`} />
                {stats[key] === null ? <Skeleton className="h-8 w-12 mx-auto" /> :
                  <p className="text-2xl font-bold text-white">{stats[key]}</p>}
                <p className="text-slate-400 text-xs">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="emergencies" className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700 flex-wrap h-auto">
            <TabsTrigger value="emergencies" className="data-[state=active]:bg-slate-700"><AlertTriangle className="w-4 h-4 mr-2" />Emergencies</TabsTrigger>
            <TabsTrigger value="hospitals" className="data-[state=active]:bg-slate-700"><Hospital className="w-4 h-4 mr-2" />Hospitals</TabsTrigger>
            <TabsTrigger value="ambulances" className="data-[state=active]:bg-slate-700"><Ambulance className="w-4 h-4 mr-2" />Ambulances</TabsTrigger>
            <TabsTrigger value="add-new" className="data-[state=active]:bg-slate-700"><Activity className="w-4 h-4 mr-2" />Add New</TabsTrigger>
          </TabsList>

          <TabsContent value="emergencies">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-400" />Emergency History</CardTitle>
                <CardDescription className="text-slate-400">Latest {EMERGENCY_LIMIT} emergencies (patient details hidden)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input placeholder="Search by date, status or location" value={emergencySearch} onChange={(e) => setEmergencySearch(e.target.value)}
                      className="pl-9 bg-slate-900/50 border-slate-600 text-white" />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="md:w-40 bg-slate-900/50 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as any)}>
                    <SelectTrigger className="md:w-40 bg-slate-900/50 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest first</SelectItem>
                      <SelectItem value="oldest">Oldest first</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {loading.emergencies ? <TableSkeleton /> : errors.emergencies ? (
                  <ErrorState message={errors.emergencies} onRetry={fetchEmergencies} />
                ) : emergencies.length === 0 ? <p className="text-slate-500 text-center py-8">No emergencies recorded yet.</p>
                  : filteredEmergencies.length === 0 ? <p className="text-slate-500 text-center py-8">No emergencies match these filters.</p> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-300">Time</TableHead>
                          <TableHead className="text-slate-300">Status</TableHead>
                          <TableHead className="text-slate-300">Location</TableHead>
                          <TableHead className="text-slate-300">SMS</TableHead>
                          <TableHead className="text-slate-300">Hospital</TableHead>
                          <TableHead className="text-slate-300">Ambulance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEmergencies.map((em) => {
                          const coord = fmtCoord(em.latitude, em.longitude);
                          return (
                            <TableRow key={em.id} className="border-slate-700">
                              <TableCell className="text-slate-300"><div className="flex items-center gap-2"><Clock className="w-3 h-3 text-slate-400" /><span className="text-xs">{fmtDate(em.created_at)}</span></div></TableCell>
                              <TableCell>
                                <Badge variant={em.status === "active" ? "destructive" : em.status === "resolved" ? "default" : "secondary"} className="text-xs">{em.status ?? "unknown"}</Badge>
                              </TableCell>
                              <TableCell className="text-slate-400">
                                {coord ? (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="w-3 h-3" /><span className="font-mono text-xs">{coord}</span>
                                    <a href={mapUrl(em.latitude!, em.longitude!)} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs inline-flex items-center gap-1">
                                      Open<ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                ) : <span className="text-slate-500">N/A</span>}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="w-3 h-3 text-slate-400" />
                                  <SMSStatusBadge status={em.guardian_notified ? "sent" : em.notified_at ? "partial" : "pending"} />
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">
                                {em.accepted_by_hospital ? <Badge variant="outline" className="text-green-400 border-green-400/30">Accepted</Badge> : <span className="text-slate-500">Pending</span>}
                              </TableCell>
                              <TableCell className="text-xs">
                                {em.dispatched_to_ambulance ? <Badge variant="outline" className="text-orange-400 border-orange-400/30">Dispatched</Badge> : <span className="text-slate-500">—</span>}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hospitals">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader><CardTitle className="text-white flex items-center gap-2"><Hospital className="h-5 w-5" />Registered Hospitals</CardTitle></CardHeader>
              <CardContent>
                <PlacesTable kind="hospital" list={filteredHospitals} all={hospitals} search={hospitalSearch} setSearch={setHospitalSearch} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ambulances">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader><CardTitle className="text-white flex items-center gap-2"><Ambulance className="h-5 w-5" />Ambulance Services</CardTitle></CardHeader>
              <CardContent>
                <PlacesTable kind="ambulance" list={filteredAmbulances} all={ambulances} search={ambulanceSearch} setSearch={setAmbulanceSearch} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="add-new">
            <div className="grid md:grid-cols-2 gap-6">
              <CreateForm type="hospital" />
              <CreateForm type="ambulance" />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && !deleting && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.type === "hospital" ? "hospital" : "ambulance service"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{pendingDelete?.item.name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPanel;
