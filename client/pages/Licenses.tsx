import { Link } from "react-router-dom";
import Seo from "@/components/seo/Seo";
import { PageHero } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Shield, FileCheck } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

const Licenses = () => {
  const { t } = useTranslation();

  return (
    <>
      <Seo
        title="Licenses & Insurance"
        description="View our California pest control licensing, insurance, and compliance documentation."
        canonicalUrl="https://nomoremosquitoes.us/licenses"
      />
      
      <PageHero
        variant="simple"
        title="Licenses & Insurance"
        description="We maintain current licensing, insurance, and compliance with all California pest control regulations."
      />

      <section className="bg-background py-20">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 sm:px-6 lg:px-8">
          
          {/* Main License Card */}
          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
            <CardHeader className="bg-primary/5 pb-8">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <FileCheck className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Pest Control Business-Main License</CardTitle>
                  <CardDescription className="text-lg font-mono font-semibold text-primary mt-2">
                    License #57621
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">License Details</h3>
                  <div className="space-y-2 text-muted-foreground">
                    <p><strong>Jurisdiction:</strong> State of California</p>
                    <p><strong>Authority:</strong> California Department of Pesticide Regulation (DPR)</p>
                    <p><strong>Type:</strong> Structural Pest Control License - Main</p>
                    <p><strong>License #:</strong> 57621</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/40">
                  <h3 className="font-semibold text-foreground mb-3">Scope of License</h3>
                  <ul className="space-y-2">
                    {["Mosquito control treatments", "Insect and pest management", "Property perimeter treatments", "Professional pest control services"].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-border/40">
                  <h3 className="font-semibold text-foreground mb-2">Compliance</h3>
                  <p className="text-sm text-muted-foreground">
                    This license is current and in good standing with the California Department of Pesticide Regulation. 
                    All work is performed in accordance with California Code of Regulations Title 3 and EPA guidelines.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Insurance & Safety Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
              <CardHeader className="bg-primary/5">
                <div className="flex items-center gap-3">
                  <Shield className="h-6 w-6 text-primary" />
                  <CardTitle>Insurance Coverage</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-3">
                  {["General Liability Insurance", "Workers' Compensation Insurance", "Property Damage Coverage", "Equipment Coverage"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
              <CardHeader className="bg-primary/5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                  <CardTitle>Compliance Standards</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-3">
                  {["EPA Registered Products", "CA Approved Formulations", "Safety Protocols", "Environmental Protection"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                        ✓
                      </Badge>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Contact Section */}
          <div className="rounded-[24px] bg-primary/5 border border-primary/20 p-8 text-center">
            <h2 className="text-xl font-semibold mb-3">Verify Our License</h2>
            <p className="text-muted-foreground mb-6">
              You can verify our license status directly with the California Department of Pesticide Regulation.
            </p>
            <a
              href="https://www.cdpr.ca.gov/wp-content/uploads/2024/08/what_we_do_at_dpr.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90"
            >
              Visit California DPR Website
            </a>
          </div>

        </div>
      </section>
    </>
  );
};

export default Licenses;
