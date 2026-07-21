const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, LevelFormat, convertInchesToTwip, ExternalHyperlink
} = require("docx");
const { convertDocxFileToPdf } = require("./convert_to_pdf");

const OUT_DIR = path.join(__dirname, "..", "assets");
const DOCX_PATH = path.join(OUT_DIR, "Thanh_VoHuy_Android_Resume.docx");
const PDF_PATH = path.join(OUT_DIR, "Thanh_VoHuy_Android_Resume.pdf");

const NAVY = "1F3A5F";
const GRAY = "555555";

// ============================================================
// LINKS — single place to update every URL used in this document.
// Anything marked PLACEHOLDER points at the main GitHub profile as a
// safe stand-in until the real target exists; swap it in when ready.
// ============================================================
const LINKS = {
  portfolio: "https://thanh0x.com",
  github: "https://github.com/Huythanh0x",
  email: "mailto:huythanh0x@gmail.com",
  linkedin: "https://www.linkedin.com/in/huythanh0x",

  // PLACEHOLDER: point this at a direct image URL once the IELTS certificate
  // is uploaded to GitHub, e.g. a raw.githubusercontent.com/.../ielts.jpg link
  // (or a GitHub Issue/repo asset URL) — anything that resolves straight to
  // the image so clicking it displays the certificate.
  ieltsCertImage: "https://github.com/Huythanh0x",

  projects: {
    // PLACEHOLDER: everything below currently points at the main GitHub
    // profile. Update each to its real target once public:
    //  - github: the actual repo URL
    //  - fdroid: the F-Droid package listing
    //  - testflight: the public TestFlight beta link
    //  - web: the hosted Compose Multiplatform web build — recommend
    //    coursedeal.thanh0x.com over coupons.thanh0x.com, since "coupons"
    //    in the public URL re-introduces the framing risk we moved away
    //    from when renaming this project
    courseDealClient: {
      github: "https://github.com/Huythanh0x",
      fdroid: "https://github.com/Huythanh0x",
      testflight: "https://github.com/Huythanh0x",
      web: "https://coursedeal.thanh0x.com",
    },
    courseDealBackend: {
      github: "https://github.com/Huythanh0x",
      apiDocs: "https://github.com/Huythanh0x",
    },
    richTextLibrary: {
      github: "https://github.com/Huythanh0x",
      maven: "https://github.com/Huythanh0x",
    },
  },
};

// Phone number is opt-in via env var, not hardcoded, so the default build
// (no env file) is always safe to publish publicly. Set PHONE_NUMBER only
// when generating a private copy (e.g. to send directly to an employer).
const PHONE_NUMBER = process.env.PHONE_NUMBER || "";

const CONTACT_PARTS = [
  { text: "thanh0x.com", url: LINKS.portfolio },
  { text: "GitHub: Huythanh0x", url: LINKS.github },
  { text: "huythanh0x@gmail.com", url: LINKS.email },
  { text: "LinkedIn: huythanh0x", url: LINKS.linkedin },
];
if (PHONE_NUMBER) {
  CONTACT_PARTS.push({
    text: PHONE_NUMBER,
    url: "tel:" + PHONE_NUMBER.replace(/[^\d+]/g, ""),
  });
}

// ---------- helpers ----------

function hyperlinkRun(text, url, size) {
  return new ExternalHyperlink({
    link: url,
    children: [new TextRun({ text, size: size || 21, color: NAVY, underline: {} })],
  });
}

function contactLine(parts) {
  const children = [];
  parts.forEach((p, i) => {
    if (i > 0) children.push(new TextRun({ text: "   |   ", size: 21, color: GRAY }));
    children.push(hyperlinkRun(p.text, p.url));
  });
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children,
  });
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 260, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 2 } },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 24, color: NAVY, characterSpacing: 12 }),
    ],
  });
}

function jobHeader(title, dates) {
  return new Paragraph({
    spacing: { before: 120, after: 20 },
    tabStops: [{ type: "right", position: convertInchesToTwip(6.5) }],
    children: [
      new TextRun({ text: title, bold: true, size: 23 }),
      new TextRun({ text: "\t" + dates, bold: true, size: 21, color: GRAY }),
    ],
  });
}

function jobSubheader(text) {
  return new Paragraph({
    spacing: { after: 20 },
    children: [new TextRun({ text: text, italics: true, size: 21, color: GRAY })],
  });
}

function jobProject(text) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: text, size: 21, italics: true, color: GRAY })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullet-list", level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text: text, size: 22 })],
  });
}

function bulletLink(text, url) {
  return new Paragraph({
    numbering: { reference: "bullet-list", level: 0 },
    spacing: { after: 60 },
    children: [hyperlinkRun(text, url, 22)],
  });
}

function skillLine(label, value) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: label + ": ", bold: true, size: 22 }),
      new TextRun({ text: value, size: 22 }),
    ],
  });
}

function plain(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22, ...opts })],
  });
}

function archNote(text) {
  return new Paragraph({
    spacing: { before: 20, after: 100 },
    children: [
      new TextRun({ text: "Architecture: ", bold: true, italics: true, size: 21, color: GRAY }),
      new TextRun({ text: text, italics: true, size: 21, color: GRAY }),
    ],
  });
}

// items: array of { label, url }. PLACEHOLDER NOTICE: callers below currently
// pass the main GitHub profile URL for every item, since none of these
// projects have a public repo/product page yet. Swap each url for the real
// one (repo, F-Droid listing, Maven/Central page, hosted API docs) once public.
function projectLinks(items) {
  const children = [];
  items.forEach((item, i) => {
    if (i > 0) children.push(new TextRun({ text: "   \u00b7   ", size: 21, color: GRAY }));
    children.push(hyperlinkRun(item.label, item.url));
  });
  return new Paragraph({ spacing: { before: 40, after: 100 }, children });
}

// ---------- document ----------

const doc = new Document({
  numbering: {
    config: [{
      reference: "bullet-list",
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: "\u2022",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 260 } } },
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 700, bottom: 700, left: 860, right: 860 },
      },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: "THANH VO HUY", bold: true, size: 40, color: NAVY })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: "Android Developer", size: 25, color: GRAY })],
      }),
      contactLine(CONTACT_PARTS),

      sectionHeading("Summary"),
      plain(
        "Android engineer with 2 years of production experience building native Android features (Kotlin, Java, MVVM) for a 2M+ user education platform, including custom UI systems, third-party SDK integration, and Flutter module embedding. Broadened into backend and AI-integrated systems (NestJS, GraphQL, Google Vertex AI) at the same company, adding a full-stack perspective on API design and system architecture. Now refocusing on Android, with hands-on Kotlin Multiplatform experience from a personal project."
      ),

      sectionHeading("Skills"),
      skillLine("Languages", "Kotlin, Java, TypeScript"),
      skillLine("Android & Mobile", "Android SDK, Jetpack (ViewModel, LiveData, Navigation, DataStore), MVVM, Clean Architecture, Compose/Kotlin Multiplatform, Flutter Module Embedding, Coroutines, Paging 3, Firebase (Crashlytics, FCM), LeakCanary"),
      skillLine("Networking & Persistence", "Retrofit, Ktor Client, Room / SQLite"),
      skillLine("DI & Testing", "Hilt, Koin, JUnit, Mockito"),
      skillLine("Tools & IDE", "Android Studio, Cursor, Claude Code, Figma"),
      skillLine("Version Control & Workflow", "Git, GitHub, Jira, Linear, Agile-Scrum"),
      skillLine("Backend", "NestJS, Spring Boot, GraphQL, REST APIs, WebSocket, TypeORM, PostgreSQL, MySQL, Redis, Docker, CI/CD, LangGraph, Google Vertex AI"),

      sectionHeading("Experience"),

      jobHeader("Backend NestJS Developer", "Jul 2025 \u2013 Present"),
      jobSubheader("Vitalify Asia Co., Ltd | Ho Chi Minh City, Vietnam"),
      jobProject("Backend systems for AI-assisted training and healthcare-related products."),
      bullet("Owned database schema design and GraphQL API development (NestJS, TypeScript, PostgreSQL, Redis) from early-stage product development through production release."),
      bullet("Gained experience integrating AI features (LangGraph, Google Vertex AI) into a production healthcare-related product's AI-assisted workflows."),
      bullet("Contributed to multi-tenant system architecture and migration, and maintained containerized services (Docker) across development and deployment."),
      bullet("Brings full-stack and AI-integration experience back to Android work, applying API-design and system-architecture judgment to mobile feature development."),

      jobHeader("Android Developer", "Jun 2023 \u2013 Jun 2025"),
      jobSubheader("Vitalify Asia Co., Ltd | Ho Chi Minh City, Vietnam"),
      jobProject("Native Android app for a 2M+ user English-learning platform connecting students with tutors through live lessons, tests, and practice flows."),
      bullet("Delivered native Android features across lesson, test, and pronunciation modules using Kotlin, Java, and MVVM, growing from fresher to senior-level ownership of feature delivery and architecture decisions."),
      bullet("Standardized inconsistent architecture patterns (navigation, state handling, UI lifecycle) across multiple modules, reducing navigation- and state-related bugs and making feature development more predictable for the team."),
      bullet("Designed and built a custom rendering pipeline for pronunciation exercises (intonation, highlighting, dynamic API-driven content), shipping a high-complexity learning UI used by millions of learners."),
      bullet("Integrated a Flutter-based mini-game into the native Android app, building a reliable native\u2013Flutter data/state bridge without breaking existing account and business logic."),
      bullet("Stabilized a third-party speech-recognition SDK (Chivox) integration across Activity/Fragment boundaries despite sparse documentation, improving reliability of speech-assessment flows in production."),
      bullet("Migrated legacy Java/Volley code toward Kotlin, MVVM, and structured state management (ViewModel/LiveData), improving JSON-parsing safety and reducing crash-prone code paths."),

      jobHeader("Freelance Software Developer", "Jul 2022 \u2013 Sep 2023"),
      jobSubheader("Remote | 2 UK-based clients"),
      bullet("Delivered browser-automation tools and a Chrome extension end-to-end, from requirement analysis through final delivery, including protocol/traffic analysis and account-scale operational tooling."),

      sectionHeading("Education"),
      new Paragraph({
        spacing: { after: 20 },
        tabStops: [{ type: "right", position: convertInchesToTwip(6.5) }],
        children: [
          new TextRun({ text: "University of Information Technology \u2013 VNUHCM", bold: true, size: 22 }),
          new TextRun({ text: "\tSep 2019 \u2013 Sep 2022", size: 22, color: GRAY }),
        ],
      }),
      plain("B.S. Computer Science, GPA 3.3", { color: GRAY, italics: true }),

      sectionHeading("Certificates"),
      bulletLink("IELTS 6.5 Academic (2022)", LINKS.ieltsCertImage),

      sectionHeading("Personal Projects"),

      new Paragraph({
        spacing: { after: 20 },
        children: [new TextRun({ text: "Course Deal Client \u2014 Kotlin Multiplatform", bold: true, size: 22 })],
      }),
      plain("Kotlin, Compose Multiplatform", { italics: true, color: GRAY }),
      bullet("Built a cross-platform client (Compose Multiplatform) sharing UI and business logic across Android and iOS, consuming a companion backend's validation and crawler APIs to surface verified course deals in real time."),
      bullet("Implemented infinite-scroll pagination (Paging 3) for the course-deal list to handle large, continuously-growing result sets efficiently."),
      bullet("Android build distributed via F-Droid due to app-store restrictions on coupon-aggregation apps."),
      bullet("Setting up an automated build and release pipeline (GitHub Actions + Fastlane) for the Android client \u2014 in progress."),
      bullet("Originally built as a native Android app (Kotlin, Retrofit, RoomDB, MVVM, Hilt, BiometricPrompt) with offline caching, later rebuilt as a cross-platform client."),
      archNote("migrated from a native Android stack (MVVM, Hilt, Retrofit) to a shared Kotlin Multiplatform module (Compose Multiplatform UI, Ktor Client networking, Koin DI) reused across Android and iOS."),
      projectLinks([
        { label: "GitHub", url: LINKS.projects.courseDealClient.github },
        { label: "Android (F-Droid)", url: LINKS.projects.courseDealClient.fdroid },
        { label: "iOS (TestFlight)", url: LINKS.projects.courseDealClient.testflight },
        { label: "Web", url: LINKS.projects.courseDealClient.web },
      ]),

      new Paragraph({
        spacing: { before: 100, after: 20 },
        children: [new TextRun({ text: "Course Deal Backend \u2014 Spring Boot Microservices", bold: true, size: 22 })],
      }),
      plain("Java, Spring Boot, MySQL, Docker", { italics: true, color: GRAY }),
      bullet("Designed a validation service that checks user-submitted course-discount links against the target platform's API in real time."),
      bullet("Built a separate crawler/ingestion pipeline that discovers and verifies deals automatically, writing results to the database with deduplication and freshness checks."),
      bullet("Hardened the link-validation endpoint against SSRF by restricting outbound requests to the target platform's own domain."),
      bullet("Powers a public web app and the companion Kotlin Multiplatform client via a shared API."),
      archNote("microservices \u2014 independently deployable crawler/ingestion and validation services sharing a common MySQL data layer, containerized with Docker."),
      projectLinks([
        { label: "GitHub", url: LINKS.projects.courseDealBackend.github },
        { label: "API Docs", url: LINKS.projects.courseDealBackend.apiDocs },
      ]),

      new Paragraph({
        spacing: { before: 100, after: 20 },
        children: [
          new TextRun({ text: "Custom Rich-Text Rendering Library \u2014 Kotlin Multiplatform ", bold: true, size: 22 }),
          new TextRun({ text: "(In Progress)", bold: true, italics: true, size: 21, color: GRAY }),
        ],
      }),
      plain("Kotlin, Compose Multiplatform (Canvas)", { italics: true, color: GRAY }),
      bullet("Rebuilding, as an independent open-source library, a custom rich-text rendering technique \u2014 mixed inline styles, phonetic sub-annotations, and intonation-curve overlays \u2014 originally developed for a custom UI feature in a production language-learning app."),
      bullet("Targeting Android, iOS, and desktop through a shared Canvas-based rendering core."),
      archNote("porting a View/Canvas-based rendering engine from native Android (Java/Kotlin) to a shared Kotlin Multiplatform Canvas API, enabling one rendering core across Android, iOS, and desktop."),
      projectLinks([
        { label: "GitHub", url: LINKS.projects.richTextLibrary.github },
        { label: "Maven", url: LINKS.projects.richTextLibrary.maven },
      ]),
    ],
  }],
});

async function build() {
  const docxBuffer = await Packer.toBuffer(doc);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(DOCX_PATH, docxBuffer);
  console.log(`Written ${DOCX_PATH}`);

  await convertDocxFileToPdf(DOCX_PATH, PDF_PATH);
  console.log(`Written ${PDF_PATH}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
