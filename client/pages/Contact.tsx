import { useState } from "react";
import { PageHero, CtaBand } from "@/components/page";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { siteConfig } from "@/data/site";
import { supabase } from "@/lib/supabase";

const Contact = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast({ title: "Missing fields", description: "Please fill in name, email, and message.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("contact_inquiries").insert({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || null,
        message: formData.message.trim(),
      });

      if (error) throw error;

      toast({
        title: "Message sent!",
        description: "We'll get back to you as soon as possible. Please allow 1–2 business days.",
      });
      setFormData({ name: "", email: "", phone: "", message: "" });
    } catch {
      toast({ title: "Error", description: "Failed to send message. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-0">
      <Seo
        title="Contact Us | No More Mosquitoes (Orange County)"
        description="Reach No More Mosquitoes for quotes, billing, or technician dispatch. We reply Monday–Saturday 7a–7p."
        canonicalUrl="https://nomoremosquitoes.us/contact"
      />

      <PageHero
        variant="centered"
        eyebrow="Get in Touch"
        title="Questions? We're here to help."
        description="Contact our team for quotes, billing inquiries, or to discuss your pest control needs. We're available Monday–Saturday, 7am–7pm."
      />

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Send us a message</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Name *
                </label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Your name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className="w-full"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email *
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className="w-full"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium mb-2">
                  Phone (optional)
                </label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="(949) 123-4567"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className="w-full"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  Message *
                </label>
                <Textarea
                  id="message"
                  name="message"
                  required
                  placeholder="Tell us about your pest control needs..."
                  value={formData.message}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className="w-full min-h-[150px]"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-6"
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </Button>
            </form>
          </div>

          {/* Contact Information */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Contact information</h2>
            <div className="space-y-6">
              {/* Phone */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Phone</h3>
                  <a
                    href={siteConfig.phone.link}
                    className="text-primary hover:underline font-medium"
                  >
                    {siteConfig.phone.display}
                  </a>
                  <p className="text-sm text-muted-foreground mt-1">
                    Call or text for immediate assistance
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Email</h3>
                  <a
                    href="mailto:info@nomoremosquitoes.us"
                    className="text-primary hover:underline font-medium"
                  >
                    info@nomoremosquitoes.us
                  </a>
                  <p className="text-sm text-muted-foreground mt-1">
                    We'll respond within 1-2 business days
                  </p>
                </div>
              </div>

              {/* Address */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Service Area</h3>
                  <p className="text-muted-foreground">
                    Orange County, California
                  </p>
                  <a
                    href="/service-area"
                    className="text-primary hover:underline text-sm mt-1 inline-block"
                  >
                    View service areas →
                  </a>
                </div>
              </div>

              {/* Hours */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Hours</h3>
                  <p className="text-muted-foreground">
                    Monday – Saturday<br />
                    7:00 AM – 7:00 PM
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Closed Sundays
                  </p>
                </div>
              </div>

              {/* Quick Links */}
              <div className="border-t pt-6 mt-6">
                <h3 className="font-semibold text-lg mb-3">Quick Links</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="/pricing" className="text-primary hover:underline">
                      View pricing
                    </a>
                  </li>
                  <li>
                    <a href="/schedule" className="text-primary hover:underline">
                      Schedule service
                    </a>
                  </li>
                  <li>
                    <a href="/faq" className="text-primary hover:underline">
                      FAQ
                    </a>
                  </li>
                  <li>
                    <a href="/login" className="text-primary hover:underline">
                      Customer login
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CtaBand
        title="Ready to reclaim your yard?"
        href="/schedule"
        ctaLabel="Schedule Service"
        description="Join hundreds of Orange County families enjoying mosquito-free yards."
      />
    </div>
  );
};

export default Contact;
