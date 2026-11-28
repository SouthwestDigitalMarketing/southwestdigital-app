// Bookkeeping Conroe local SEO plan, from the Chris Palmer study.
// Source of truth for the plan: All Thing concepts/seo-strategy-chris-palmer.md
// and sops/sop-local-seo-calendar.md; listing state: bookkeepingconroe-web
// docs/nap-consistency.md. Update the status here when an item moves.

export type SeoPlanStatus = "done" | "waiting" | "todo" | "check" | "ongoing";

export type SeoPlanItem = {
  title: string;
  status: SeoPlanStatus;
  what: string;
  next?: string;
  blocker?: string;
};

export type SeoPlanSection = { title: string; items: SeoPlanItem[] };

export const SEO_PLAN_AS_OF = "2026-11-24";

export const SEO_PLAN_STATUS_LABEL: Record<SeoPlanStatus, string> = {
  done: "Done",
  waiting: "Waiting",
  todo: "To do",
  check: "Needs a check",
  ongoing: "Ongoing",
};

export const SEO_PLAN: SeoPlanSection[] = [
  {
    title: "Website",
    items: [
      {
        title: "Stop review gating on /review",
        status: "done",
        what: "The review page only sent 5-star answers to Google. That breaks Google's rules and gets reviews filtered. Every visitor now sees the Google review link.",
        next: "Nothing. Shipped in bookkeepingconroe-web PR #78 (2026-11-18).",
      },
      {
        title: "Test each town page against Conroe",
        status: "done",
        what: "Palmer's rule: if two towns show the same search results, one page is enough. Every town showed different results, so all 5 town pages stay.",
        next: "Nothing. Tested 2026-11-18 and 2026-11-19 (DataForSEO).",
      },
      {
        title: "Strengthen the 5 town pages",
        status: "done",
        what: "County, ZIP codes and neighborhoods inside each town page, plus links to them that say \"Bookkeeping in <town>\".",
        next: "Nothing. PR #81 (2026-11-18).",
      },
      {
        title: "No FAQ headings on money pages",
        status: "done",
        what: "Palmer moved question headings off sales pages. Town pages and the homepage now use statements; FAQ schema removed there.",
        next: "Nothing. PR #87 (2026-11-19).",
      },
      {
        title: "Schema: profile link, listings, Thomas",
        status: "done",
        what: "The page code now links the Google profile (static map link), Manta, ChamberofCommerce.com and Pinterest, and describes Thomas as the founder.",
        next: "Add each new listing (Apple, Yelp, Bing) to sameAs once it goes live.",
      },
      {
        title: "Homepage H1: bookkeeper, Conroe",
        status: "done",
        what: "The homepage's main heading lacked both words. It now reads \"Bookkeeper in Conroe, TX\".",
        next: "Nothing. PR #88 (2026-11-20).",
      },
      {
        title: "Rental words on real estate page",
        status: "done",
        what: "We were missing from the map pack for \"rental property bookkeeping conroe tx\". The page title and body now use that phrase.",
        next: "Watch the next map scan for that term.",
      },
      {
        title: "Descriptive link words",
        status: "done",
        what: "Links say what the page is (\"QuickBooks cleanup in Conroe\"), not \"Learn more\". Footer has a Bookkeeping column.",
        next: "Nothing. PRs #81 and #87.",
      },
      {
        title: "Veteran-owned line on the site",
        status: "done",
        what: "Backs the veteran-owned attribute on the Google profile.",
        next: "Nothing. PR #87.",
      },
      {
        title: "Hide junk pages from Google",
        status: "done",
        what: "Style guide and under-development pages are noindex; /studio and /discovery are blocked in robots.txt.",
        next: "Recheck in the 90-day index review.",
      },
      {
        title: "Answer page: bookkeeping cost",
        status: "done",
        what: "Palmer's top answer page. Live at /bookkeeping-cost.",
        next: "More answer pages go in one a month (see Every month).",
      },
      {
        title: "Benchmark money pages vs top 5",
        status: "todo",
        what: "Compare word count, headings and key terms on each service page with the top 3-5 results for its search. The homepage was checked 2026-11-19 and already wins.",
        next: "Do the 6 service pages, real estate and short-term rental.",
      },
      {
        title: "Stop form spam",
        status: "todo",
        what: "Since the move to Vercel (2026-11-19) every website form fill has been spam: about 27 from one bot, 10 sales pitches, a few gibberish. A real lead would be buried.",
        next: "Add a silent filter in /api/forms (too-fast submits, the known bot message, gibberish).",
        blocker: "Waiting on Tom's go.",
      },
    ],
  },
  {
    title: "Google Business Profile",
    items: [
      {
        title: "Posts every other day",
        status: "ongoing",
        what: "One post per money page, each linking to that page, scheduled in Google with the Schedule switch.",
        next: "Scheduled through 2026-12-09. Write and schedule the next batch before 2026-12-05.",
      },
      {
        title: "Categories, services, products",
        status: "check",
        what: "One main category matching the homepage. Services = only ones with a site page; remove ones Google added. Products named \"service + town\", each linking its page.",
        next: "Confirm what was saved on 2026-11-18 (products were being added that day) and finish any gaps.",
        blocker: "No written record of what got saved.",
      },
      {
        title: "Trim the service area",
        status: "check",
        what: "Houston, Huntsville and New Waverly are listed but have no pages and sit 25+ miles out. Keep the county and the towns we have pages for.",
        next: "Open the profile and check; remove the three if still there.",
      },
      {
        title: "Replace stock and wrong-office photos",
        status: "todo",
        what: "The profile has a stock-looking high-five photo and an office photo that is not our office. Six real stills from our videos are ready on Nostromo (listing-stills-2026-11-21).",
        next: "Remove the two bad photos; upload the real stills.",
      },
      {
        title: "New phone photos at the office",
        status: "todo",
        what: "At least 3 each: outside, inside, Tom at work, Tom. Real phone photos, unique file names, no AI images. Repeat every 90 days.",
        blocker: "Needs Tom at the office with his phone.",
      },
      {
        title: "No UTM tag on the website link",
        status: "done",
        what: "Palmer says tracking tags on the profile link hurt. Ours is the plain URL.",
      },
    ],
  },
  {
    title: "Listings",
    items: [
      {
        title: "Manta, chambers",
        status: "done",
        what: "Live with name, address and phone copied word for word from Google.",
      },
      {
        title: "Apple Maps (Apple Business)",
        status: "waiting",
        what: "Organization \"Lochside LLC\" sent for Apple's review 2026-11-20 (up to 5 business days).",
        next: "When the approval email reaches tmacdonald7@gmail.com, add the Beach Walk location.",
        blocker: "Apple's review.",
      },
      {
        title: "Bing Places",
        status: "check",
        what: "Synced from Google 2026-11-15, was pending publish.",
        next: "Check it is live; add it to schema sameAs.",
      },
      {
        title: "Yelp",
        status: "check",
        what: "Claimed 2026-11-15, was pending moderation.",
        next: "Check it is live.",
        blocker: "Yelp's SMS codes do not reach the Quo line.",
      },
      {
        title: "Data Axle",
        status: "waiting",
        what: "No self-serve add; asked by email 2026-11-16.",
        next: "Follow up around 2026-11-30 if not added.",
      },
      {
        title: "BBB, Hotfrog, Foursquare",
        status: "waiting",
        what: "Submitted 2026-11-16, pending their review. Foursquare claim ($20) skipped.",
        next: "Check each is live.",
      },
      {
        title: "Other data aggregators",
        status: "todo",
        what: "Neustar/Localeze, Dun & Bradstreet, Acxiom, Experian (free ones only). They feed MapQuest and others.",
      },
      {
        title: "Copy the winners' listings",
        status: "todo",
        what: "Search each top-3 map competitor's name and street address in quotes. The directories they share are the ones to join.",
        next: "Run once; add the 2-3 niche listings we lack.",
      },
      {
        title: "Bing Webmaster Tools + sitemap",
        status: "todo",
        what: "Free. Bing's version of Search Console.",
      },
    ],
  },
  {
    title: "Reviews",
    items: [
      {
        title: "Steady review asks",
        status: "todo",
        what: "A few a month, never a burst. Clients say in their own words which service and which town. From their own phone. We have 10 Google reviews.",
        next: "Personal ask after each finished month-end report.",
        blocker: "Each ask needs Tom's yes before it is sent.",
      },
      {
        title: "Reply to reviews within 24h",
        status: "ongoing",
        what: "Thank them and name the service in plain words.",
      },
    ],
  },
  {
    title: "Every month",
    items: [
      {
        title: "Search Console 5-20 loop",
        status: "todo",
        what: "Find searches where a page sits at 5-20; put the exact phrase in a heading or sentence; wait 14-30 days. Then 20-60. Property set up 2026-11-18.",
        next: "First run in the first week of December, once data has built up.",
      },
      {
        title: "Internal-link check",
        status: "todo",
        what: "Links > Internal: money pages should be the most linked; \"Home\" and \"Learn more\" should not be top link words.",
        next: "First run in the first week of December.",
      },
      {
        title: "One answer page a month",
        status: "ongoing",
        what: "One question per page (what a bookkeeper does, bookkeeper vs CPA, QuickBooks cleanup, rental-owner setup). Never per city. Each links up to its service page.",
      },
      {
        title: "Map grid scan every 2 weeks",
        status: "ongoing",
        what: "Baseline 2026-11-21: top 3 in 63% of points for \"bookkeeper\"; we drop off about 8 miles south (The Woodlands, Spring). Goal: push the south edge.",
        next: "Next scan around 2026-12-05.",
      },
      {
        title: "Scoreboard: calls, form fills",
        status: "todo",
        what: "Palmer's scorecard is calls, form fills and reviews, not rank. One table for Tom each month.",
        blocker: "Form fills are all spam right now (see Website: Stop form spam).",
      },
      {
        title: "Microsoft Clarity heatmaps",
        status: "todo",
        what: "Free. Shows where visitors click and stop, and whether phone and form are seen above the fold.",
      },
    ],
  },
];

// Numbers SWapp cannot read yet; update with the date when they change.
export const SEO_SCORE = {
  googleReviews: { value: 10, asOf: "2026-11-15", note: "on the Google profile; 2 are from family" },
  realFormLeads: { value: 0, of: 42, from: "2026-11-19", to: "2026-11-24", note: "every website form fill was spam or a test" },
};

/** Words used for the top-3 share on the Overview: Palmer's broad term, searched from the office. */
export const SEO_GOAL_KEYWORD = "bookkeeper";
