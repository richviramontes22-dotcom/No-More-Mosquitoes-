import { useParams, Link, useNavigate } from "react-router-dom";
import { blogPosts } from "@/data/blog";
import Seo from "@/components/seo/Seo";
import { CtaBand } from "@/components/page";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Calendar, Clock } from "lucide-react";

// Blog post content mapping - in a real app, this would come from a CMS
const blogContent: Record<string, { content: string; author: string }> = {
  "spring-mosquito-prep-orange-county": {
    author: "Sarah Martinez",
    content: `
## Spring Mosquito Prep for Orange County Neighborhoods

As spring arrives in Orange County, so does the season of buzzing nuisances. With temperatures rising and rain creating perfect breeding grounds, now is the ideal time to prepare your property for the peak mosquito season ahead.

### Understanding the Spring Mosquito Boom

Winter and early spring rains create standing water in every corner of our yards—gutters, planters, bird baths, and low-lying areas. These pools are mosquito nurseries. A single female mosquito can lay 100-300 eggs in water as small as a bottle cap, and they hatch within 24-48 hours.

### Step 1: Eliminate Standing Water

**Inspect and drain:**
- Check gutters and downspouts for clogged debris
- Empty plant saucers and bird baths daily (or use mosquito dunks)
- Fix leaky outdoor faucets and hose connections
- Ensure yard slopes away from structures for proper drainage
- Clear catch basins and storm drains on your property

**Pro tip:** If you have decorative water features, use beneficial bacteria (Bti - Bacillus thuringiensis israelensis) to kill larvae without harming fish or plants.

### Step 2: Adjust Irrigation Schedules

Orange County's spring often brings unpredictable rainfall. Over-watering compounds the standing water problem.

- Run irrigation early morning or late evening to reduce evaporation
- Check soil moisture before watering—spring rains may mean less frequent watering
- Adjust sprinkler coverage to avoid puddling in low spots
- Install drip irrigation in problem areas instead of sprinklers
- Consider moisture sensors that prevent watering after rain

### Step 3: Trim Vegetation

Mosquitoes rest in tall grass and dense shrubs during the day.

- Mow regularly to keep grass 2-3 inches tall
- Trim shrub bases to eliminate shaded resting spots
- Prune tree branches 6-8 feet from the ground for air circulation
- Remove dead wood and fallen leaves where mosquitoes hide
- Keep yard open and breezy

### Step 4: Professional Treatment

While prevention is crucial, spring is the ideal time to establish a professional treatment program before populations explode.

Our spring treatment approach:
- Targets adult resting areas with plant-based perimeter sprays
- Treats drainage zones with larvicide to prevent breeding
- Applies family-safe, pet-friendly formulations
- Includes follow-up treatments timed to life cycles

### Timeline: When to Act

**Late February - Early March:** Inspect property, eliminate standing water, trim vegetation

**Mid-March:** Schedule first professional treatment before temperatures consistently hit 70°F

**April onward:** Maintain regular service (typically every 14-30 days depending on your plan)

### Spring Success Checklist

- ☑ Cleared gutters and downspouts
- ☑ Eliminated standing water sources
- ☑ Adjusted irrigation timing
- ☑ Trimmed back vegetation
- ☑ Scheduled professional spring treatment
- ☑ Planned regular maintenance through peak season

### Why Spring Treatment Works

Spring treatment catches populations while they're still manageable. A single treatment in March prevents 10x the problem in July. Plus, spring weather (consistent warm temperatures but before extreme heat) ensures our formulations work optimally.

---

**Ready to protect your spring gatherings?** No More Mosquitoes' licensed technicians handle the hard work while you enjoy your backyard from day one. Get a free quote based on your property's acreage and yard layout.
    `
  },
  "what-to-expect-after-your-first-visit": {
    author: "Mike Chen",
    content: `
## What to Expect After Your First No More Mosquitoes Visit

Your first mosquito treatment marks day one of reclaiming your outdoor space. Here's exactly what happens before, during, and after your visit.

### Before Your Appointment (48 Hours Prior)

**What we ask you to do:**
- Clear the backyard of toys, furniture, and pet bedding
- Bring pets indoors 2 hours before treatment
- Ensure accessible walkways around the perimeter
- Note any specific problem areas (standing water, ant hills, shaded zones)
- Don't cut grass day-of (longer blades help product distribution)

**What we prepare:**
- Confirm treatment type based on your property details
- Load vehicle with treatment solutions and safety equipment
- Brief technician on your property specifics

### During the Visit (30-45 minutes typical)

Our technician arrives in clearly marked vehicle at your scheduled time. Here's what they do:

1. **Property walk-through:** Scout your yard for breeding zones, entry points, and resting areas
2. **Customer briefing:** Explain what they'll treat and answer questions
3. **Application:** Apply California-approved, EPA-registered formulations to:
   - Perimeter vegetation (30+ feet around structures)
   - Entry points around doors and windows
   - Drainage zones and low areas
   - Shrub bases and fence lines
4. **Safety verification:** Confirm treatment zones and post-treatment precautions
5. **HD video:** Film completion video showing treated areas

### Immediately After (First 2 Hours)

**You can:**
- Water plants and grass normally
- Go about your day indoors
- Let kids play in non-treated interior areas

**You shouldn't:**
- Go outside unnecessarily
- Let pets back outside for 2+ hours
- Touch treated surfaces or vegetation
- Water plants in treated areas for 4 hours

### First 24 Hours

**What you'll notice:**
- Visible improvement in mosquito activity by evening
- Some treated insects may appear sluggish or dying (normal)
- Mild herbaceous smell from plant-based formulations (fades quickly)
- Possibly seeing wasps or other insects clearing the treated areas (beneficial)

**Yard use:**
- ✅ Kids and pets can use yard normally after 2 hours
- ✅ Safe for food prep areas, play spaces, pet bowls
- ✅ Safe for pollinators and beneficial insects

**Maintenance:**
- Continue your standing water elimination routine
- Don't pressure wash treated areas for 48 hours
- Avoid brushing heavily against treated vegetation

### Your Completion Video

Within 2 hours of service, you'll receive an HD video showing:
- Pre-treatment walkthrough of your specific property
- Treatment process and areas covered
- Post-treatment safety briefing
- Technician recommendations for your yard

Access it anytime to remember which areas were treated or show family members what was done.

### Days 3-7: Observation Phase

**What to expect:**
- Dramatic reduction in mosquito activity
- Very few, if any, bites during outdoor time
- Visible decrease in activity around patio/deck areas
- Improved outdoor comfort

**If you see mosquitoes:**
- Normal—complete 100% kill takes 3-5 days
- Some from neighboring properties may drift over
- Remaining mosquitoes are typically non-biting males

### Beyond First Week

Your property is now under protection. Depending on your service plan:

**14-day service:** Next visit scheduled in 14 days
- Best for high-traffic yards or areas near water
- Comprehensive coverage throughout warm season

**21-day service:** Next visit in 21 days
- Optimal for most Orange County properties
- Balances protection with natural insect ecosystem

**30-day service:** Next visit in 30 days
- Effective for lower-risk properties
- Cost-efficient for seasonal coverage

**42-day service:** Next visit in 42 days
- Suitable for properties with good natural drainage
- Works well combined with strong prevention habits

### Your First Month

We recommend:
- Keep up with standing water elimination
- Note any patterns (more activity in certain areas)
- Take photos/video if recurring issues develop
- Share feedback during second visit
- Adjust service frequency if needed

### Red Flags to Report

Contact us immediately if:
- New standing water sources appear
- Persistent activity in specific yard areas
- Rust or staining from treated vegetation (usually normal, but we want to know)
- Any safety concerns or allergic reactions

### Long-Term Success

Most customers find by month 2-3:
- Dramatic outdoor lifestyle improvement
- Kids playing outside without fear of bites
- Evening gatherings without constant swatting
- Confidence planning outdoor events

**Your satisfaction guarantee:** If mosquitoes return between scheduled visits, we re-service at no charge. That's our 100% satisfaction promise.

---

**Ready for your first visit?** Schedule today and join hundreds of Orange County families enjoying bite-free backyards.
    `
  },
  "tick-safety-guide-for-southern-california": {
    author: "Dr. James Rodriguez",
    content: `
## Tick Safety Guide for Southern California Families

Ticks are often overlooked compared to mosquitoes, but they pose serious health risks in Southern California. This guide covers identification, prevention, and protection strategies for Orange County families.

### Understanding Ticks in SoCal

Southern California hosts two primary tick species that concern families:

**Brown Dog Tick (Rhipicephalus sanguineus)**
- Year-round presence in SoCal
- Primary hosts: dogs, but will bite humans
- Most common in yards and homes
- Rapid reproduction indoors if not controlled

**Deer Tick (Ixodes scapularis)**
- Growing presence in coastal and elevated SoCal areas
- Known vector for Lyme disease
- Active spring through fall, peak in late spring/early summer
- Found in brush, tall grass, wooded areas

### Health Risks Beyond Itching

Ticks transmit:
- Lyme disease (Deer ticks primarily)
- Rocky Mountain spotted fever (Dog ticks and Deer ticks)
- Anaplasmosis (Deer ticks)
- Babesiosis (Deer ticks)
- Ehrlichiosis (Lone Star ticks, less common in CA)

Early detection and removal within 24 hours significantly reduces transmission risk.

### Prevention Zone Strategy

**Protect Your Perimeter (First 10 feet from house)**
- Clear all brush, tall grass, and debris
- Maintain open spacing between yard and wild areas
- Remove leaf litter where ticks hide
- Keep mulch 3+ feet from structures

**Control Wildlife Pathways (10-30 feet)**
- Trim overhanging tree branches (6+ feet high)
- Remove brush piles and dead wood
- Install fencing to deter deer movement
- Clear tall grass in play areas

**Buffer Zones (30+ feet)**
- This is where professional treatment becomes critical
- Dense vegetation, brush, and tree bases are prime tick habitat
- Perimeter treatment creates a protective barrier

### Personal Protection for High-Risk Activities

**Before Trail Activities:**
- Wear long pants tucked into socks
- Wear light-colored clothing (ticks are visible)
- Apply EPA-registered tick repellent to clothing/skin
- Insecticide treatments on clothing kill ticks on contact

**After Outdoor Time:**
- Shower within 2 hours
- Check entire body (behind ears, scalp, groin, armpits)
- Check children thoroughly—they often don't notice ticks
- Check pets completely, especially underarms and ears

**At Home:**
- Dry clothing on high heat for 10+ minutes kills ticks
- Wash clothing separately if heavily exposed
- Check pet bedding frequently

### Tick Removal: What to Do If Bitten

**Correct removal within 24 hours is critical.**

**What TO do:**
1. Use fine-tipped tweezers or tick removal tool
2. Grasp tick as close to skin as possible
3. Pull straight out with steady, even pressure
4. Place tick in sealed bag or container
5. Save the tick (photo, container)—it can be tested for disease
6. Wash area with soap and water
7. Apply antibiotic ointment

**What NOT to do:**
- Don't squeeze, crush, or puncture the tick
- Don't twist or jerk (leaves mouthparts in skin)
- Don't apply petroleum jelly, nail polish, or heat
- Don't use bare fingers
- These methods cause the tick to inject pathogenic saliva

### Tick Checks for Kids

Make it routine:
- Daily check during tick season
- Focus on warm, moist areas
- Show kids where ticks hide (ears, hairline, armpits)
- Normalize the habit—many families do daily checks

### Professional Yard Treatment

While personal prevention is important, comprehensive yard protection requires professional treatment.

**Our tick control approach:**
- Target perimeter vegetation (primary tick habitat)
- Treat brush lines, tree bases, and ground cover
- Apply to fence lines and garden borders
- Follow deer tick ecology (shade, moisture preference)
- Use family-safe, pet-safe formulations

**Why it works:**
- Ticks can't survive treated areas
- Creates protective barrier around living spaces
- Reduces tick populations before they attach
- Prevents indoor infestations

**Recommended timing:**
- Spring (April-May): Before peak season
- Summer (June-July): During peak activity
- Regular maintenance: 21-30 day intervals through fall

### Tick Season Timeline

**Spring (March-May):**
- Nymphs (immature ticks) emerge
- Tiny but dangerous—easily missed
- Peak transmission risk for Lyme disease
- Start protection early

**Summer (June-August):**
- Peak tick activity and biting
- Adult ticks active
- Highest reported tick-borne illness cases
- Maintain consistent yard treatment

**Fall (September-November):**
- Second peak for adult activity
- Continuing disease transmission risk
- Preparation for winter indoor activity

**Winter:**
- Reduced outdoor activity
- Brown dog ticks remain active indoors (in homes)
- Plan spring strategy

### Red Flags: When to See a Doctor

Seek medical attention if bitten by a tick and you develop:
- Rash (especially "bull's-eye" pattern)
- Fever or chills
- Joint or muscle pain
- Fatigue or malaise
- Headache

Report to your doctor:
- When the bite occurred
- Tick species (if known)
- Geographic location where exposed
- Saved tick specimen (if available)

### Year-Round Tick Strategy

**Home protection:**
- Yard perimeter treatment every 21-30 days
- Indoor pest control if Brown dog ticks appear
- Regular pet flea/tick medication

**Personal protection:**
- Daily tick checks during outdoor season
- Proper clothing for trail activities
- Prompt removal if bitten
- Medical follow-up for symptoms

**Community awareness:**
- Teach kids about tick risks (without fear)
- Share prevention habits with neighbors
- Report tick-borne illness cases to local health department
- Support community tick education

---

**Don't let ticks steal your family's outdoor time.** No More Mosquitoes provides comprehensive tick and flea defense treatment protecting your Orange County property year-round. Get a free assessment of your tick risk and treatment plan.
    `
  }
};

const BlogPostDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const post = blogPosts.find(p => p.slug === slug);
  const content = slug ? blogContent[slug] : null;

  if (!post || !content) {
    return (
      <div className="flex flex-col gap-0 min-h-screen">
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
          <h1 className="text-3xl font-bold mb-4">Post not found</h1>
          <p className="text-muted-foreground mb-8">
            This blog post doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate("/blog")} variant="outline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Blog
          </Button>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(post.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="flex flex-col gap-0">
      <Seo
        title={`${post.title} | No More Mosquitoes Blog`}
        description={post.excerpt}
        canonicalUrl={`https://nomoremosquitoes.us/blog/${slug}`}
      />

      {/* Header */}
      <div className="bg-gradient-to-b from-muted/50 to-background border-b">
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <Button
            variant="ghost"
            className="mb-6"
            onClick={() => navigate("/blog")}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Blog
          </Button>
          <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
          <p className="text-lg text-muted-foreground mb-6">{post.excerpt}</p>

          {/* Metadata */}
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{post.readingTimeMinutes} min read</span>
            </div>
            <div>
              <span>By {content.author}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <article className="prose prose-sm sm:prose max-w-none dark:prose-invert">
          {content.content.split('\n').map((paragraph, idx) => {
            if (paragraph.startsWith('###')) {
              return (
                <h3 key={idx} className="text-xl font-bold mt-6 mb-3">
                  {paragraph.replace(/^###\s*/, '')}
                </h3>
              );
            }
            if (paragraph.startsWith('##')) {
              return (
                <h2 key={idx} className="text-2xl font-bold mt-8 mb-4">
                  {paragraph.replace(/^##\s*/, '')}
                </h2>
              );
            }
            if (paragraph.startsWith('-') || paragraph.startsWith('☑')) {
              return (
                <li key={idx} className="ml-4 mb-2">
                  {paragraph.replace(/^[-☑]\s*/, '')}
                </li>
              );
            }
            if (paragraph.trim().startsWith('**')) {
              return (
                <p key={idx} className="font-semibold mb-3">
                  {paragraph.replace(/\*\*/g, '')}
                </p>
              );
            }
            if (paragraph.trim()) {
              return (
                <p key={idx} className="mb-4 leading-relaxed">
                  {paragraph}
                </p>
              );
            }
            return null;
          })}
        </article>
      </div>

      {/* Related CTA */}
      <CtaBand
        title="Ready to protect your yard?"
        href="/schedule"
        ctaLabel="Schedule Service"
        description="Apply the protection strategies from this article with professional-grade treatment."
      />
    </div>
  );
};

export default BlogPostDetail;
