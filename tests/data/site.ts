// Locators match on visible text and accessible names
export const PROFILE = {
  name: "Stefan Mandovski",
  headline: "Senior QA Automation Engineer",
  linkedIn: "https://www.linkedin.com/in/mandovski/",
  cvPdf: "assets/cv/Stefan-Mandovski-CV.pdf",
} as const;

// Home page sectors - the nav label and the headings
export const SECTIONS = {
  about: { nav: "About", heading: "Testing as a craft, not a checkbox" },
  experience: { nav: "Experience", heading: "Where I've worked" },
  skills: { nav: "Skills", heading: "Tools & technologies" },
  projects: { nav: "Projects", heading: "What I've built" },
  contact: { nav: "Contact", heading: "Let's talk testing" },
} as const;

export type SectionId = keyof typeof SECTIONS;

// Roles, newest first - the timeline and the CV list them in following order
export const ROLES = ["School Management Platform", "Electricity Auction Platform", "US Pet Retailer", "NS NL"] as const;

// Skill bars on the home page and the percentage each one shows
export const SKILLS = {
  Playwright: 95,
  TestCafe: 90,
  "SQL & data validation": 80,
  "Gatling / performance testing": 70,
  "Azure DevOps & CI/CD": 75,
  "AI-assisted testing tooling": 80,
} as const;

// The featured project and the AI providers its card lists
export const SHIFT_BOARD = {
  name: "Shift Board",
  providers: ["Claude Code", "OpenAI", "Z.ai", "Kimi"],
} as const;

// Limits for a mid-range phone on 4G
export const PERF_BUDGET = { lcpMs: 2500, cls: 0.1, transferKb: 150 };

// Every published page
export const SITE_PAGES = [
  { path: "/", name: "home" },
  { path: "/cv.html", name: "CV" },
  { path: "/qa-suite.html", name: "QA suite runner" },
  { path: "/404.html", name: "not found" },
] as const;
