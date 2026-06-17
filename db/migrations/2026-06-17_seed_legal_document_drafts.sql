-- ============================================================
-- Seed: Legal document drafts (attorney-review stage)
--
-- Inserts the four required document types as status='draft' rows.
-- Content mirrors reports/2026-06-17/{TERMS_AND_CONDITIONS,PRIVACY_POLICY,
-- SERVICE_AGREEMENT,PESTICIDE_CONSENT_AND_ACKNOWLEDGEMENT}_DRAFT.md.
--
-- These are NOT deployed. status stays 'draft' until an admin moves them
-- through attorney_review -> approved -> deployed via /admin/legal.
-- Idempotent: only inserts if no row of that document_type exists yet.
-- ============================================================

INSERT INTO public.legal_documents (document_type, title, version, status, content_md)
SELECT 'terms_and_conditions', 'Terms and Conditions', '0.1-draft', 'draft', $doc$> **Draft for attorney review. Do not deploy until reviewed and approved by qualified legal counsel.**

# Terms and Conditions
**No More Mosquitoes**
Draft version: 0.1-draft
Draft date: 2026-06-17

## 1. Acceptance of Terms

By creating an account, requesting a quote, scheduling a service, or otherwise using the services of No More Mosquitoes ("Company," "we," "us"), you ("Customer," "you") agree to be bound by these Terms and Conditions.

## 2. Services Provided

The Company provides residential and commercial mosquito and pest control treatment services within its designated service areas in California. Services are performed by licensed, insured technicians using formulations approved by the California Department of Pesticide Regulation (CDPR). The Company's Pest Control Business License number is 57621.

## 3. Scheduling, Access, and Cancellations

3.1. Appointments are scheduled based on route availability and arrive within a quoted time window; actual arrival may vary due to weather, traffic, or prior-stop duration.

3.2. Customer agrees to provide safe, reasonable access to all treatment areas, including gated yards, at the scheduled time.

3.3. The Company may reschedule, at no charge, when weather conditions would materially reduce treatment effectiveness.

3.4. [DRAFT — cancellation/rescheduling notice period and any associated fee to be specified by counsel and ops.]

## 4. Payment Terms

4.1. Customer authorizes recurring or one-time charges to the payment method on file for the selected service plan (subscription, one-time treatment, or annual plan), as described at checkout.

4.2. [DRAFT — late payment, failed payment, and collections language to be added by counsel.]

## 5. Service Guarantee

[DRAFT — insert the Company's specific satisfaction/re-treatment guarantee terms, conditions, and exclusions here. Coordinate with the public Guarantee page content for consistency.]

## 6. Pets, Children, and Re-Entry

Pets and children should be kept off treated surfaces during application and for a period after application as directed by the technician or product label. See the separate Pesticide Consent & Acknowledgement document for details specific to chemical applications.

## 7. Limitation of Liability

[DRAFT — counsel to draft limitation-of-liability, indemnification, and disclaimer-of-warranty provisions appropriate for a pesticide-application service business operating in California.]

## 8. Dispute Resolution

[DRAFT — counsel to determine whether arbitration, governing law/venue, and class-action-waiver provisions are appropriate and enforceable for this business.]

## 9. Modifications to These Terms

The Company may update these Terms from time to time. Material changes will be reflected in a new version, and continued use of the service after a new version is deployed and accepted (where acceptance is required) constitutes agreement to the updated Terms.

## 10. Contact

Questions about these Terms may be directed to the Company's support contact listed on the website.

---
*This document is a draft prepared for internal review and is not yet approved for use. It does not constitute legal advice and must be reviewed by a licensed attorney before being presented to customers.*
$doc$
WHERE NOT EXISTS (SELECT 1 FROM public.legal_documents WHERE document_type = 'terms_and_conditions');

INSERT INTO public.legal_documents (document_type, title, version, status, content_md)
SELECT 'privacy_policy', 'Privacy Policy', '0.1-draft', 'draft', $doc$> **Draft for attorney review. Do not deploy until reviewed and approved by qualified legal counsel.**

# Privacy Policy
**No More Mosquitoes**
Draft version: 0.1-draft
Draft date: 2026-06-17

## 1. Information We Collect

- **Account information**: name, email address, phone number, password (stored hashed by our authentication provider).
- **Service information**: property address, lot size/acreage, service preferences, scheduling preferences, payment method (processed by our payment processor — we do not store full card numbers).
- **Communications**: messages, notes, and support requests you send us.
- **Technical information**: device/browser metadata, IP address, and similar data collected automatically when you use our website.
- [DRAFT — counsel to confirm whether GPS/location data collected from field technicians during service visits should be referenced here, and whether any customer-facing location data is collected.]

## 2. How We Use Information

We use the information above to: provide and schedule pest control services; process payments; communicate appointment confirmations, reminders, and service updates; respond to support requests; and improve our services.

## 3. Information Sharing

We do not sell personal information. We share information only with:
- Service providers who help us operate (payment processing, email/SMS delivery, hosting, scheduling/routing infrastructure).
- Our technicians, to the extent necessary to perform a scheduled service.
- As required by law, or to protect the rights, property, or safety of the Company, our customers, or others.

## 4. Data Retention

[DRAFT — counsel to specify retention periods for account data, service history, and communications, and how deletion requests are handled.]

## 5. Your Choices and Rights

5.1. You may update your account information at any time through your customer portal.

5.2. You may opt out of marketing communications while continuing to receive transactional/service-related messages.

5.3. [DRAFT — counsel to add CCPA/CPRA-specific disclosures and rights language, since the Company operates in California: right to know, delete, correct, and opt out of "sale" or "sharing" as those terms are defined under California law, plus a "Do Not Sell or Share My Personal Information" mechanism if applicable.]

## 6. Cookies and Tracking

[DRAFT — counsel/marketing to confirm what analytics or advertising cookies, if any, are used on the public website, and add corresponding disclosure.]

## 7. Data Security

We use reasonable administrative, technical, and physical safeguards to protect personal information. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.

## 8. Children's Privacy

Our services are not directed to children, and we do not knowingly collect personal information from children.

## 9. Changes to This Policy

We may update this Privacy Policy from time to time. Material changes will be reflected in a new version.

## 10. Contact Us

Questions about this Privacy Policy may be directed to the Company's support contact listed on the website.

---
*This document is a draft prepared for internal review and is not yet approved for use. It does not constitute legal advice and must be reviewed by a licensed attorney — including for California privacy law (CCPA/CPRA) compliance — before being presented to customers.*
$doc$
WHERE NOT EXISTS (SELECT 1 FROM public.legal_documents WHERE document_type = 'privacy_policy');

INSERT INTO public.legal_documents (document_type, title, version, status, content_md)
SELECT 'service_agreement', 'Service Agreement', '0.1-draft', 'draft', $doc$> **Draft for attorney review. Do not deploy until reviewed and approved by qualified legal counsel.**

# Service Agreement
**No More Mosquitoes**
Draft version: 0.1-draft
Draft date: 2026-06-17

## 1. Parties and Scope

This Service Agreement ("Agreement") is between No More Mosquitoes ("Company") and the customer named on the associated service order ("Customer"), covering the mosquito/pest control service plan selected at checkout (recurring subscription, one-time treatment, or annual plan).

## 2. Service Plan Terms

2.1. **Subscription plans** recur on the cadence selected at signup (e.g., every 14/21/30/42 days) until canceled by the Customer or the Company.

2.2. **One-time treatments** consist of a single scheduled visit with no recurring obligation.

2.3. **Annual plans** are prepaid for a 12-month service term as described at checkout.

2.4. Pricing is determined by property acreage and selected cadence, as published on the Company's pricing page at the time of purchase. [DRAFT — counsel to confirm whether price-change notice provisions are needed for active subscriptions.]

## 3. Cancellation and Refunds

3.1. Subscription plans may be canceled at any time through the customer portal; cancellation takes effect at the end of the then-current billing period unless otherwise stated.

3.2. [DRAFT — counsel/ops to specify refund eligibility, if any, for partially-used annual plans or canceled one-time treatments already in progress.]

## 4. Customer Obligations

4.1. Customer will provide safe and reasonable property access for each scheduled visit.

4.2. Customer will promptly report any adverse reaction, property concern, or service issue to the Company.

4.3. Customer is responsible for keeping payment information current; failed payments may result in suspended service. [DRAFT — counsel to confirm grace period and suspension/reinstatement terms.]

## 5. Company Obligations

5.1. The Company will perform scheduled services using licensed technicians and CDPR-approved formulations.

5.2. The Company will provide reasonable advance notice of schedule changes.

5.3. [DRAFT — insert specific service-level commitments and remedies, e.g., re-treatment guarantee, coordinated with the public Guarantee page.]

## 6. Term and Termination

This Agreement remains in effect for the duration of the selected service plan and any renewal thereof, until terminated by either party as described above.

## 7. Relationship to Terms and Conditions

This Agreement supplements, and should be read together with, the Company's general Terms and Conditions. In the event of a conflict, [DRAFT — counsel to specify which document controls].

## 8. Governing Law

[DRAFT — counsel to specify governing law/venue, consistent with the Terms and Conditions.]

---
*This document is a draft prepared for internal review and is not yet approved for use. It does not constitute legal advice and must be reviewed by a licensed attorney before being presented to customers.*
$doc$
WHERE NOT EXISTS (SELECT 1 FROM public.legal_documents WHERE document_type = 'service_agreement');

INSERT INTO public.legal_documents (document_type, title, version, status, content_md)
SELECT 'pesticide_consent', 'Pesticide Consent and Acknowledgement', '0.1-draft', 'draft', $doc$> **Draft for attorney review. Do not deploy until reviewed and approved by qualified legal counsel.**

# Pesticide Consent and Acknowledgement
**No More Mosquitoes**
Draft version: 0.1-draft
Draft date: 2026-06-17

## 1. Purpose of This Document

This document discloses the nature of pesticide/mosquito-control treatments applied at the Customer's property and records the Customer's informed consent and acknowledgement of the precautions described below.

## 2. Products and Application Method

2.1. Treatments use formulations registered with and approved by the California Department of Pesticide Regulation (CDPR), applied by licensed, trained technicians in accordance with product label directions.

2.2. [DRAFT — list specific active ingredients/product categories used (e.g., barrier sprays, larvicides, in-vegetation treatments), or reference a product-disclosure document maintained separately and kept current as products change.]

## 3. Pre- and Post-Treatment Precautions

3.1. Customer should secure pets and ensure children remain off treated surfaces during application.

3.2. Treated areas should not be watered, mowed, or otherwise disturbed for a period after application as directed by the technician or the product label, in order to preserve treatment effectiveness and allow products to dry/settle.

3.3. Individuals with chemical sensitivities, respiratory conditions, pregnancy, or other health considerations should consult a physician regarding any necessary precautions before treatment and may request advance notice of scheduled applications. [DRAFT — counsel to confirm appropriate disclosure and accommodation language, and whether a specific notice period must be offered.]

## 4. Known Risks

Pesticide products, even when applied according to label directions, may pose risks to certain individuals, pets, or sensitive plantings. [DRAFT — counsel to draft an appropriately balanced risk-disclosure statement; do not understate or overstate risk without legal/technical review.]

## 5. Acknowledgement

By accepting this document, Customer acknowledges that they have read and understood the information above, have had the opportunity to ask questions about the treatment, and consent to the application of pest control products at the property identified on their account, subject to the precautions described above.

## 6. Right to Decline or Request Information

Customer may request additional product information (including Safety Data Sheets) prior to a scheduled treatment, or may decline a specific treatment, by contacting the Company in advance of the scheduled visit.

## 7. Re-Acknowledgement

This consent applies to the products and methods described in the version of this document the Customer accepted. If the Company materially changes the products or methods used, an updated version of this document will be issued and re-acceptance may be required.

---
*This document is a draft prepared for internal review and is not yet approved for use. It does not constitute legal advice and must be reviewed by a licensed attorney — and, for product-specific content, by a qualified pest control technical/regulatory reviewer — before being presented to customers.*
$doc$
WHERE NOT EXISTS (SELECT 1 FROM public.legal_documents WHERE document_type = 'pesticide_consent');
