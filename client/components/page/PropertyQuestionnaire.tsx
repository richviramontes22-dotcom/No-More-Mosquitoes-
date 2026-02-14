import { useState } from "react";
import { useTranslation } from "@/hooks/use-translation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export const PropertyQuestionnaire = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    hasPets: false,
    petDetails: "",
    childrenUseYard: false,
    primaryConcerns: "",
    hasStandingWater: false,
    yardUsage: "weekly",
    gateInstructions: "",
  });

  const usageOptions = t("questionnaire.usageOptions");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      toast({
        title: t("questionnaire.success"),
        description: "Your property preferences have been updated.",
      });
    }, 1000);
  };

  return (
    <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-foreground">
          {t("questionnaire.title")}
        </CardTitle>
        <CardDescription>
          {t("questionnaire.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Pets */}
            <div className="flex flex-col gap-4 p-4 rounded-2xl bg-muted/30 border border-border/40">
              <div className="flex items-center justify-between">
                <Label htmlFor="hasPets" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  {t("questionnaire.pets")}
                </Label>
                <Switch
                  id="hasPets"
                  checked={formData.hasPets}
                  onCheckedChange={(checked) => setFormData({ ...formData, hasPets: checked })}
                />
              </div>
              {formData.hasPets && (
                <Input
                  placeholder={t("questionnaire.petsHint")}
                  value={formData.petDetails}
                  onChange={(e) => setFormData({ ...formData, petDetails: e.target.value })}
                  className="bg-background/50"
                />
              )}
            </div>

            {/* Children */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/40">
              <Label htmlFor="childrenUseYard" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {t("questionnaire.children")}
              </Label>
              <Switch
                id="childrenUseYard"
                checked={formData.childrenUseYard}
                onCheckedChange={(checked) => setFormData({ ...formData, childrenUseYard: checked })}
              />
            </div>

            {/* Standing Water */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/40">
              <Label htmlFor="hasStandingWater" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {t("questionnaire.waterSources")}
              </Label>
              <Switch
                id="hasStandingWater"
                checked={formData.hasStandingWater}
                onCheckedChange={(checked) => setFormData({ ...formData, hasStandingWater: checked })}
              />
            </div>

            {/* Yard Usage */}
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-muted/30 border border-border/40">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {t("questionnaire.usage")}
              </Label>
              <Select
                value={formData.yardUsage}
                onValueChange={(val) => setFormData({ ...formData, yardUsage: val })}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{usageOptions?.daily || "Daily"}</SelectItem>
                  <SelectItem value="weekly">{usageOptions?.weekly || "Weekly"}</SelectItem>
                  <SelectItem value="weekends">{usageOptions?.weekends || "Weekends only"}</SelectItem>
                  <SelectItem value="occasionally">{usageOptions?.occasionally || "Occasionally"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="primaryConcerns" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {t("questionnaire.concerns")}
              </Label>
              <Input
                id="primaryConcerns"
                placeholder={t("questionnaire.concernsPlaceholder") || "Mosquitoes, ticks, spiders, etc."}
                value={formData.primaryConcerns}
                onChange={(e) => setFormData({ ...formData, primaryConcerns: e.target.value })}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gateInstructions" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {t("questionnaire.gateInstructions")}
              </Label>
              <Textarea
                id="gateInstructions"
                placeholder={t("questionnaire.gateInstructionsPlaceholder") || "Enter gate codes or specific access notes..."}
                value={formData.gateInstructions}
                onChange={(e) => setFormData({ ...formData, gateInstructions: e.target.value })}
                className="bg-background/50 resize-none h-24"
              />
            </div>
          </div>

          <Button type="submit" className="w-full rounded-xl py-6 text-base font-bold" disabled={loading}>
            {loading ? t("questionnaire.saving") : t("questionnaire.save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PropertyQuestionnaire;
