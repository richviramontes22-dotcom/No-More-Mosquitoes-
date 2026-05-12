import React, { useState, useMemo, useEffect } from "react";
import { format, addDays, startOfDay, isSameDay, isBefore } from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Home,
  MapPin,
  User,
  ClipboardList,
  Phone,
  Building2,
  Plus
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { PropertyQuestionnaire, PropertyQuestionnaireData } from "@/components/page/PropertyQuestionnaire";
import { AddPropertyDialog } from "@/components/dashboard/properties/AddPropertyDialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, withTimeout } from "@/lib/supabase";

const TIME_SLOTS = [
  "9:00 AM – 11:00 AM",
  "11:00 AM – 1:00 PM",
  "1:00 PM – 3:00 PM",
  "3:00 PM – 5:00 PM",
];

type OccupiedSlot = { date: string; times: string[] };

function scheduledAtToSlot(scheduledAt: string): string | null {
  const hour = new Date(scheduledAt).getHours();
  if (hour < 11) return "9:00 AM – 11:00 AM";
  if (hour < 13) return "11:00 AM – 1:00 PM";
  if (hour < 15) return "1:00 PM – 3:00 PM";
  if (hour < 17) return "3:00 PM – 5:00 PM";
  return null;
}

type Step = "property" | "date-time" | "questionnaire" | "summary";

interface Property {
  id: string;
  address: string;
  zip: string;
  acreage: number;
  isMock?: boolean;
}

interface ScheduleFlowProps {
  onSuccess: (data: any) => void;
  onCancel: () => void;
  initialAddress?: string;
}

export const ScheduleFlow = ({ onSuccess, onCancel, initialAddress }: ScheduleFlowProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("property");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [contactPhone, setContactPhone] = useState("");
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isUpdatingPreferences, setIsUpdatingPreferences] = useState(false);
  const [visitNotes, setVisitNotes] = useState("");
  const [occupiedSlots, setOccupiedSlots] = useState<OccupiedSlot[]>([]);

  // Fetch real appointment availability from Supabase
  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const now = new Date();
        const sixtyDaysOut = new Date(now);
        sixtyDaysOut.setDate(now.getDate() + 60);

        const { data, error } = await supabase
          .from("appointments")
          .select("scheduled_at")
          .in("status", ["requested", "scheduled"])
          .gte("scheduled_at", now.toISOString())
          .lte("scheduled_at", sixtyDaysOut.toISOString());

        if (error || !data) return;

        // Group slots by date
        const grouped: Record<string, string[]> = {};
        for (const row of data) {
          if (!row.scheduled_at) continue;
          const slot = scheduledAtToSlot(row.scheduled_at);
          if (!slot) continue;
          const dateKey = row.scheduled_at.slice(0, 10);
          if (!grouped[dateKey]) grouped[dateKey] = [];
          if (!grouped[dateKey].includes(slot)) grouped[dateKey].push(slot);
        }

        setOccupiedSlots(
          Object.entries(grouped).map(([date, times]) => ({ date, times }))
        );
      } catch {
        // Availability fetch is non-critical — fail silently, all slots remain open
      }
    };

    fetchAvailability();
  }, []);

  const [questionnaireData, setQuestionnaireData] = useState<PropertyQuestionnaireData>({
    hasPets: false,
    petDetails: "",
    childrenUseYard: false,
    primaryConcerns: "",
    hasStandingWater: false,
    yardUsage: "weekly",
    gateInstructions: "",
  });

  const fetchProperties = async () => {
    if (!user) {
      setProperties([]);
      setSelectedPropertyId(null);
      return;
    }
    setIsLoadingProperties(true);
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("id, address, zip, acreage")
        .eq("user_id", user.id);

      if (error) throw error;

      const allProperties = (data || []) as Property[];
      setProperties(allProperties);

      if (allProperties.length > 0 && !selectedPropertyId) {
        setSelectedPropertyId(allProperties[0].id);
      } else if (allProperties.length === 0) {
        setSelectedPropertyId(null);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
      setProperties([]);
      setSelectedPropertyId(null);
    } finally {
      setIsLoadingProperties(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [user]);

  const selectedProperty = useMemo(() =>
    properties.find(p => p.id === selectedPropertyId),
  [properties, selectedPropertyId]);

  const isDateFullyBooked = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const occupied = occupiedSlots.find(s => s.date === dateStr)?.times || [];
    return occupied.length >= TIME_SLOTS.length;
  };

  const availableSlotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const occupied = occupiedSlots.find(s => s.date === dateStr)?.times || [];
    return TIME_SLOTS.map(time => ({
      time,
      isAvailable: !occupied.includes(time) && !isBefore(selectedDate, startOfDay(new Date()))
    }));
  }, [selectedDate]);

  const handleNext = () => {
    if (step === "property") {
      if (!selectedPropertyId) {
        toast({ title: "Property Required", description: "Please select a property for service." });
        return;
      }
      if (!contactPhone.trim()) {
        toast({ title: "Phone Required", description: "Please provide a contact number for the technician." });
        return;
      }
      setStep("date-time");
    } else if (step === "date-time") {
      if (!selectedDate || !selectedTime) {
        toast({ title: "Selection Required", description: "Please select a date and time slot." });
        return;
      }
      setStep("questionnaire");
    } else if (step === "questionnaire") {
      setStep("summary");
    }
  };

  const handleBack = () => {
    if (step === "date-time") setStep("property");
    if (step === "questionnaire") setStep("date-time");
    if (step === "summary") setStep("questionnaire");
  };

  const handleFinalize = async () => {
    if (!selectedProperty || !user) return;

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("No active session");

      const response = await withTimeout(fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          acreage: selectedProperty.acreage,
          cadenceDays: 30, // Default to 30 days for new signups via this flow
          program: "subscription",
          appointmentDate: selectedDate,
          appointmentTime: selectedTime,
          notes: visitNotes,
        }),
      }), 10000, "Checkout session");

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create checkout session");

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error("Checkout Error:", error);
      toast({
        title: "Checkout Unavailable",
        description: error.message || "We couldn't connect to Stripe. Please try again later.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Add Property Dialog */}
      <AddPropertyDialog
        open={isAddPropertyOpen}
        onOpenChange={setIsAddPropertyOpen}
        onSuccess={(newProp) => {
          fetchProperties();
          setSelectedPropertyId(newProp.id);
        }}
      />

      {/* Progress Stepper */}
      <div className="flex items-center justify-between max-w-2xl mx-auto mb-12 px-4">
        {[
          { id: "property", label: "Property", icon: Building2 },
          { id: "date-time", label: "Timing", icon: Clock },
          { id: "questionnaire", label: "Details", icon: ClipboardList },
          { id: "summary", label: "Review", icon: CheckCircle2 },
        ].map((s, idx, arr) => {
          const isCompleted = arr.findIndex(item => item.id === step) > idx;
          const isActive = s.id === step;

          return (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-3">
                <div className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-sm",
                  isActive ? "border-primary bg-primary text-primary-foreground scale-110" :
                  isCompleted ? "border-primary bg-primary/10 text-primary" :
                  "border-muted bg-muted/30 text-muted-foreground"
                )}>
                  { isCompleted ? <CheckCircle2 className="h-6 w-6" /> : <s.icon className="h-5 w-5" /> }
                </div>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest hidden sm:block",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>{s.label}</span>
              </div>
              {idx < arr.length - 1 && (
                <div className={cn(
                  "h-[2px] flex-1 mx-2 sm:mx-4 transition-colors duration-500",
                  isCompleted ? "bg-primary" : "bg-muted"
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="min-h-[450px] max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar transition-all duration-500 ease-in-out">
        {step === "property" && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-display font-bold">Where should we spray?</h2>
              <p className="text-muted-foreground">Confirm your service address and contact details.</p>
            </div>

            <div className="grid gap-6">
              <div className="space-y-4">
                <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Select Property</Label>
                {isLoadingProperties ? (
                  <div className="flex items-center justify-center p-12 bg-muted/20 rounded-[28px] border border-dashed border-border">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                  </div>
                ) : properties.length > 0 ? (
                  <div className="grid gap-4">
                    {properties.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPropertyId(p.id)}
                        className={cn(
                          "flex items-center gap-4 p-5 rounded-[24px] border-2 text-left transition-all hover:border-primary/40",
                          selectedPropertyId === p.id ? "border-primary bg-primary/5 shadow-md ring-4 ring-primary/5" : "border-border/60 bg-card"
                        )}
                      >
                        <div className={cn(
                          "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors",
                          selectedPropertyId === p.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          <Home className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-lg">{p.address}</p>
                          <p className="text-sm text-muted-foreground font-medium">ZIP: {p.zip} • {p.acreage} Acres</p>
                        </div>
                        {selectedPropertyId === p.id && <CheckCircle2 className="h-6 w-6 text-primary" />}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-muted/20 rounded-[28px] border border-dashed border-border space-y-4">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                      <Home className="h-6 w-6" />
                    </div>
                    <p className="text-muted-foreground font-medium italic">No properties found. Please add a property in your profile first.</p>
                    <Button variant="outline" className="rounded-xl" onClick={() => setIsAddPropertyOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Property
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button variant="link" className="text-primary text-xs font-bold uppercase tracking-widest p-0 h-auto" onClick={() => setIsAddPropertyOpen(true)}>
                  <Plus className="mr-1 h-3 w-3" /> Add another location
                </Button>
              </div>

              <div className="space-y-4">
                <Label htmlFor="contact-phone" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Best Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="contact-phone"
                    placeholder="(555) 000-0000"
                    className="pl-12 h-14 rounded-2xl text-lg font-medium border-2 focus-visible:ring-primary/20"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    type="tel"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground font-medium">Technicians will use this number for arrival updates.</p>
              </div>
            </div>
          </div>
        )}

        {step === "date-time" && (
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
            <Card className="rounded-[32px] border-border/60 shadow-soft overflow-hidden border-2">
              <CardHeader className="bg-primary/5 border-b border-border/40 p-6">
                <CardTitle className="text-xl font-display">Select Date</CardTitle>
                <CardDescription>Pick an available window for your service.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setSelectedTime(null);
                  }}
                  className="rounded-md border-none w-full"
                  disabled={(date) => isBefore(date, startOfDay(new Date())) || isDateFullyBooked(date)}
                />
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-[32px] border-border/60 shadow-soft overflow-hidden border-2 h-full">
                <CardHeader className="bg-primary/5 border-b border-border/40 p-6">
                  <CardTitle className="text-xl font-display">Arrival Window</CardTitle>
                  <CardDescription className="font-medium text-primary">
                    {selectedDate ? format(selectedDate, "PPPP") : "Pick a date on the calendar"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {selectedDate ? (
                    <div className="grid gap-3">
                      {availableSlotsForDate.map((slot) => (
                        <button
                          key={slot.time}
                          className={cn(
                            "group relative flex items-center justify-between p-5 rounded-2xl border-2 transition-all text-left",
                            selectedTime === slot.time ? "border-primary bg-primary/5 ring-4 ring-primary/5" : "border-border/60 hover:border-primary/30",
                            !slot.isAvailable && "opacity-40 cursor-not-allowed bg-muted/50 border-transparent grayscale"
                          )}
                          disabled={!slot.isAvailable}
                          onClick={() => setSelectedTime(slot.time)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                              selectedTime === slot.time ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                            )}>
                              <Clock className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-bold">{slot.time}</p>
                              {!slot.isAvailable && <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Fully Booked</p>}
                            </div>
                          </div>
                          {selectedTime === slot.time && <CheckCircle2 className="h-5 w-5 text-primary" />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                      <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center text-primary/40 animate-pulse">
                        <CalendarIcon className="h-8 w-8" />
                      </div>
                      <p className="text-muted-foreground font-medium italic max-w-[200px]">Select a date to view available time slots.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === "questionnaire" && (
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="preferences" className="border-none">
                <Card className="rounded-[32px] border-border/60 shadow-soft overflow-hidden border-2">
                  <CardHeader className="bg-primary/5 p-0">
                    <AccordionTrigger className="px-8 py-6 hover:no-underline">
                      <div className="flex flex-col items-start text-left gap-1">
                        <CardTitle className="text-2xl font-display">Property Preferences</CardTitle>
                        <CardDescription>
                          {isUpdatingPreferences
                            ? "Update your yard details for this and future visits."
                            : "Reviewing your current property settings."}
                        </CardDescription>
                      </div>
                    </AccordionTrigger>
                  </CardHeader>
                  <AccordionContent className="p-0">
                    <CardContent className="p-8 pt-0">
                      <div className="flex justify-end mb-4">
                        <Button
                          variant={isUpdatingPreferences ? "default" : "outline"}
                          size="sm"
                          className="rounded-xl shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsUpdatingPreferences(!isUpdatingPreferences);
                          }}
                        >
                          {isUpdatingPreferences ? "Lock Preferences" : "Enable Editing"}
                        </Button>
                      </div>
                      <div className={cn("transition-opacity duration-300", !isUpdatingPreferences && "opacity-60")}>
                        <PropertyQuestionnaire
                          data={questionnaireData}
                          onChange={setQuestionnaireData}
                          hideSubmit={true}
                          disabled={!isUpdatingPreferences}
                        />
                      </div>
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            </Accordion>

            <Card className="rounded-[32px] border-border/60 shadow-soft overflow-hidden border-2">
              <CardHeader className="bg-primary/5 border-b border-border/40 p-8">
                <CardTitle className="text-xl font-display">Visit Notes & Comments</CardTitle>
                <CardDescription>Specific instructions for this appointment only.</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <Textarea
                  placeholder="e.g., Gate will be unlocked, please avoid the north flower beds today..."
                  className="rounded-2xl min-h-[120px] bg-background border-border/60 focus:border-primary/40 focus:ring-primary/5 transition-all"
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {step === "summary" && (
          <div className="max-w-2xl mx-auto space-y-6 animate-in zoom-in-95 duration-500">
            <div className="text-center space-y-2 mb-8">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary mb-4">
                <ClipboardList className="h-8 w-8" />
              </div>
              <h2 className="text-3xl font-display font-bold">Review Appointment</h2>
              <p className="text-muted-foreground">Confirm your service details below.</p>
            </div>

            <Card className="rounded-[32px] border-border/60 shadow-soft overflow-hidden border-2">
              <CardHeader className="bg-primary text-primary-foreground p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Service Summary</CardTitle>
                    <p className="text-primary-foreground/70 text-sm font-medium mt-1">Confirmed Arrival Window</p>
                  </div>
                  <Badge variant="secondary" className="bg-white/20 text-white border-none px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                    Ready
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-10 space-y-10">
                <div className="grid gap-8 sm:grid-cols-2">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Timing</p>
                      <div className="flex items-center gap-3 font-bold text-xl">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                        {selectedDate && format(selectedDate, "MMM d, yyyy")}
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground font-semibold">
                        <Clock className="h-4 w-4" />
                        {selectedTime}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Service Address</p>
                      <div className="flex items-start gap-3 font-bold text-lg leading-tight">
                        <MapPin className="h-5 w-5 text-primary mt-1" />
                        <span>{selectedProperty?.address || initialAddress || "Primary Location"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Contact & Site</p>
                      <ul className="space-y-3">
                        <li className="flex items-center gap-3 text-sm font-bold">
                          <Phone className="h-4 w-4 text-primary" />
                          {contactPhone}
                        </li>
                        <li className="flex items-center gap-3 text-sm font-bold">
                          <CheckCircle2 className={cn("h-4 w-4", questionnaireData.hasPets ? "text-primary" : "text-muted-foreground/30")} />
                          Pets: {questionnaireData.hasPets ? "Yes" : "No"}
                        </li>
                        <li className="flex items-center gap-3 text-sm font-bold">
                          <CheckCircle2 className={cn("h-4 w-4", questionnaireData.hasStandingWater ? "text-primary" : "text-muted-foreground/30")} />
                          Standing water: {questionnaireData.hasStandingWater ? "Yes" : "No"}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {visitNotes && (
                  <div className="p-6 rounded-[24px] bg-amber-500/5 border border-amber-500/10">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600/60 mb-3">Appointment Notes</p>
                    <p className="text-sm font-medium italic text-amber-700/80">"{visitNotes}"</p>
                  </div>
                )}

                {questionnaireData.gateInstructions && (
                  <div className="p-6 rounded-[24px] bg-primary/5 border border-primary/10">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 mb-3">Special Instructions</p>
                    <p className="text-sm font-medium italic text-primary/80">"{questionnaireData.gateInstructions}"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-10 border-t border-border/40 sticky bottom-0 bg-background/80 backdrop-blur-md z-10 pb-4">
        <Button
          variant="ghost"
          className="rounded-2xl px-8 h-14 font-bold text-muted-foreground hover:bg-muted"
          onClick={step === "property" ? onCancel : handleBack}
          disabled={isSubmitting}
        >
          {step === "property" ? "Cancel" : <><ArrowLeft className="mr-2 h-5 w-5" /> Back</>}
        </Button>

        <Button
          className="rounded-2xl px-10 h-14 shadow-brand min-w-[200px] font-bold text-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
          onClick={step === "summary" ? handleFinalize : handleNext}
          disabled={isSubmitting || (step === "property" && properties.length === 0)}
        >
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
          ) : step === "summary" ? (
            "Confirm & Schedule"
          ) : (
            <>{step === "questionnaire" ? "Continue to Review" : "Next Step"} <ArrowRight className="ml-2 h-5 w-5" /></>
          )}
        </Button>
      </div>
    </div>
  );
};
