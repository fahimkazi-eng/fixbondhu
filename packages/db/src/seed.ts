/**
 * FixBondhu catalogue seed.
 *
 * This seeds REAL reference data only: the divisions, districts and localities
 * of Bangladesh, and the service categories FixBondhu trades in, each carrying
 * its Bangla, Banglish and English names plus the search keywords real
 * customers type.
 *
 * It deliberately seeds NO users, NO providers, NO bookings, NO reviews and NO
 * statistics. A marketplace that launches with invented providers and invented
 * ratings is a marketplace customers cannot trust, and the request for this
 * project was explicit that none of that may be faked. An empty marketplace is
 * honest; a fake one is not. Provider onboarding supplies real supply.
 *
 * Search columns are filled through buildSearchTerms() so the seed and the
 * write path can never disagree about how a term is indexed.
 */

import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSearchTerms, slugify, slugifyBangla } from "../../../packages/core/src/index";
import { PrismaClient } from "../src/generated/prisma/client";

const here = path.dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  path.resolve(here, "../../../.env"),
  path.resolve(here, "../../.env"),
]) {
  // Load explicitly; the Prisma CLI's dotenv call is not in scope here.
  const { config } = await import("dotenv");
  config({ path: candidate, quiet: true });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

interface DistrictSeed {
  code: string;
  nameEn: string;
  nameBn: string;
  lat: number;
  lng: number;
  areas: Array<{ nameEn: string; nameBn: string; aliases?: string[]; lat: number; lng: number }>;
}

const DIVISIONS = [
  { code: "DHK", nameEn: "Dhaka", nameBn: "ঢাকা", lat: 23.8103, lng: 90.4125 },
  { code: "CHT", nameEn: "Chattogram", nameBn: "চট্টগ্রাম", lat: 22.3569, lng: 91.7832 },
  { code: "KHL", nameEn: "Khulna", nameBn: "খুলনা", lat: 22.8456, lng: 89.5403 },
  { code: "RAJ", nameEn: "Rajshahi", nameBn: "রাজশাহী", lat: 24.3745, lng: 88.6042 },
  { code: "SYL", nameEn: "Sylhet", nameBn: "সিলেট", lat: 24.8949, lng: 91.8687 },
  { code: "RNG", nameEn: "Rangpur", nameBn: "রংপুর", lat: 25.7439, lng: 89.2752 },
  { code: "MYS", nameEn: "Mymensingh", nameBn: "ময়মনসিংহ", lat: 24.7471, lng: 90.4203 },
  { code: "BAR", nameEn: "Barishal", nameBn: "বরিশাল", lat: 22.7010, lng: 90.3535 },
] as const;

const DISTRICTS: Array<{ division: string } & DistrictSeed> = [
  {
    division: "DHK",
    code: "DK-01",
    nameEn: "Dhaka District",
    nameBn: "ঢাকা জেলা",
    lat: 23.8103,
    lng: 90.4125,
    areas: [
      { nameEn: "Gulshan", nameBn: "গুলশান", aliases: ["gulshan", "gulshan 1", "gulshan 2"], lat: 23.7925, lng: 90.4077 },
      { nameEn: "Banani", nameBn: "বনানী", aliases: ["banani", "banani dohs"], lat: 23.7937, lng: 90.4066 },
      { nameEn: "Uttara", nameBn: "উত্তরা", aliases: ["uttara", "uttara sector 1", "sector 7"], lat: 23.8759, lng: 90.3795 },
      { nameEn: "Mirpur", nameBn: "মিরপুর", aliases: ["mirpur", "mirpur 10", "mirpur 11", "kacha bazar"], lat: 23.8042, lng: 90.3712 },
      { nameEn: "Dhanmondi", nameBn: "ধানমন্ডি", aliases: ["dhanmondi", "dhanmondi 32"], lat: 23.7461, lng: 90.3825 },
      { nameEn: "Mohammadpur", nameBn: "মোহাম্মদপুর", aliases: ["mohammadpur", "mohammadpur more", "shyamoli"], lat: 23.7653, lng: 90.3830 },
      { nameEn: "Bashundhara R/A", nameBn: "বসুন্ধরা আবাসিক", aliases: ["bashundhara", "bashundhara ra", "bashundhara residential"], lat: 23.8223, lng: 90.4325 },
      { nameEn: "Farmgate", nameBn: "ফার্মগেট", aliases: ["farmgate", "kazi khiraj"], lat: 23.7559, lng: 90.3857 },
      { nameEn: "Shahbagh", nameBn: "শাহবাগ", aliases: ["shahbagh", "shahbagh 2"], lat: 23.7539, lng: 90.3713 },
      { nameEn: "Tejgaon", nameBn: "তেজগাঁও", aliases: ["tejgaon", "tejgaon industrial"], lat: 23.7594, lng: 90.3910 },
      { nameEn: "Malibagh", nameBn: "মালিবাগ", aliases: ["malibagh", "moghul bazar"], lat: 23.7589, lng: 90.3730 },
      { nameEn: "Badda", nameBn: "বড়দা", aliases: ["badda", "badda bazar", "merul badda"], lat: 23.7445, lng: 90.4060 },
    ],
  },
  { division: "CHT", code: "CTG-01", nameEn: "Chattogram District", nameBn: "চট্টগ্রাম জেলা", lat: 22.3569, lng: 91.7832,
    areas: [
      { nameEn: "Agrabad", nameBn: "আগ্রাবাদ", aliases: ["agrabad"], lat: 22.2937, lng: 91.8010 },
      { nameEn: "GEC Circle", nameBn: "জিইসি মোড়", aliases: ["gec circle", "gec"], lat: 22.3105, lng: 91.7970 },
    ] },
  { division: "KHL", code: "KHL-01", nameEn: "Khulna District", nameBn: "খুলনা জেলা", lat: 22.8456, lng: 89.5403,
    areas: [
      { nameEn: "Khulna Sadar", nameBn: "খুলনা সদর", aliases: ["khulna", "khulna sadar"], lat: 22.8456, lng: 89.5403 },
    ] },
  { division: "RAJ", code: "RAJ-01", nameEn: "Rajshahi District", nameBn: "রাজশাহী জেলা", lat: 24.3745, lng: 88.6042,
    areas: [
      { nameEn: "Rajshahi Sadar", nameBn: "রাজশাহী সদর", aliases: ["rajshahi", "rajshahi sadar"], lat: 24.3745, lng: 88.6042 },
    ] },
  { division: "SYL", code: "SYL-01", nameEn: "Sylhet District", nameBn: "সিলেট জেলা", lat: 24.8949, lng: 91.8687,
    areas: [
      { nameEn: "Sylhet Sadar", nameBn: "সিলেট সদর", aliases: ["sylhet", "sylhet sadar", "zindabazar"], lat: 24.8949, lng: 91.8687 },
      { nameEn: "Shahjalal", nameBn: "শাহজালাল", aliases: ["shahjalal", "shahjalal upashahar"], lat: 24.9045, lng: 91.8611 },
    ] },
  { division: "RNG", code: "RNG-01", nameEn: "Rangpur District", nameBn: "রংপুর জেলা", lat: 25.7439, lng: 89.2752,
    areas: [{ nameEn: "Rangpur Sadar", nameBn: "রংপুর সদর", aliases: ["rangpur"], lat: 25.7439, lng: 89.2752 }] },
  { division: "MYS", code: "MYS-01", nameEn: "Mymensingh District", nameBn: "ময়মনসিংহ জেলা", lat: 24.7471, lng: 90.4203,
    areas: [{ nameEn: "Mymensingh Sadar", nameBn: "ময়মনসিংহ সদর", aliases: ["mymensingh"], lat: 24.7471, lng: 90.4203 }] },
  { division: "BAR", code: "BAR-01", nameEn: "Barishal District", nameBn: "বরিশাল জেলা", lat: 22.7010, lng: 90.3535,
    areas: [{ nameEn: "Barishal Sadar", nameBn: "বরিশাল সদর", aliases: ["barishal"], lat: 22.7010, lng: 90.3535 }] },
];

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

interface ServiceSeed {
  nameEn: string;
  nameBn: string;
  nameBanglish: string;
  keywords: string[];
  emergency?: boolean;
  durationMinutes?: number;
}

interface CategorySeed {
  slug: string;
  nameEn: string;
  nameBn: string;
  nameBanglish: string;
  icon: string;
  keywords: string[];
  services: ServiceSeed[];
}

const CATALOGUE: CategorySeed[] = [
  {
    slug: "ac-cooling",
    nameEn: "AC & Cooling",
    nameBn: "এসি ও কুলিং",
    nameBanglish: "AC ar cooling",
    icon: "snowflake",
    keywords: ["air conditioner", "aircon", "cooling", "chiller"],
    services: [
      { nameEn: "AC Repair", nameBn: "এসি রিপেয়ার", nameBanglish: "AC repair", keywords: ["ac repair", "ac thik", "ac kharab", "ac servicing", "air conditioner repair"], durationMinutes: 90 },
      { nameEn: "AC Gas Refill", nameBn: "এসি গ্যাস রিফিল", nameBanglish: "AC gas refill", keywords: ["gas refill", "gas charge", "freon", "refill", "gas refill korbo"], durationMinutes: 60 },
      { nameEn: "AC Installation", nameBn: "এসি ইনস্টল", nameBanglish: "AC install", keywords: ["installation", "install", "new ac", "ac lagano", "mounting"], durationMinutes: 120 },
      { nameEn: "AC Cleaning & Servicing", nameBn: "এসি পরিষ্কার ও সার্ভিসিং", nameBanglish: "AC cleaning servicing", keywords: ["cleaning", "servicing", "maintenance", "ac cleaning"], durationMinutes: 60 },
      { nameEn: "AC Shifting", nameBn: "এসি স্থানান্তর", nameBanglish: "AC shifting", keywords: ["shifting", "relocation", "ac move", "transfer"], durationMinutes: 180 },
      // Geyser and water heating is a distinct, very high-demand job in
      // Bangladesh and is routinely searched for as "giasar", "gejar" or
      // "water heater". It was missing from the first version of this
      // catalogue and the search verification surfaced the gap.
      { nameEn: "Geyser Installation & Repair", nameBn: "গিজার লাগানো ও মেরামত", nameBanglish: "Geyser installation repair", keywords: ["geyser", "gejar", "giasar", "giasr", "water heater", "hot water", "গিজার", "গেজার"], emergency: true, durationMinutes: 90 },
    ],
  },
  {
    slug: "electrical",
    nameEn: "Electrical",
    nameBn: "ইলেকট্রিক্যাল",
    nameBanglish: "Electric",
    icon: "zap",
    keywords: ["electrician", "wiring", "switch", "power"],
    services: [
      { nameEn: "Electrician Visit", nameBn: "ইলেকট্রিশিয়ান", nameBanglish: "Electrician", keywords: ["electrician", "elektrishian", "electrishian", "elec", "বিদ্যুৎ", "wiring", "switchboard", "electrical repair"], emergency: true, durationMinutes: 60 },
      { nameEn: "Switch & Socket Repair", nameBn: "সুইচ ও সকেট মেরামত", nameBanglish: "Switch socket repair", keywords: ["switch", "socket", "plug", "dimmer"], durationMinutes: 45 },
      { nameEn: "Fan Installation & Repair", nameBn: "ফ্যান লাগানো ও মেরামত", nameBanglish: "Fan installation repair", keywords: ["fan", "pankha", "ceiling fan", "fan thik", "fan repair", "exhaust fan"], emergency: true, durationMinutes: 45 },
      { nameEn: "Wiring & Rewiring", nameBn: "তার সংযোগ", nameBanglish: "Wiring rewiring", keywords: ["wiring", "rewiring", "cable", "wire", "short circuit"], durationMinutes: 180 },
      { nameEn: "Light & Tube Fittings", nameBn: "বাতি ও টিউব লাগানো", nameBanglish: "Light tube fitting", keywords: ["light", "tube", "tubelight", "led", "chandelier"], durationMinutes: 45 },
      { nameEn: "MCB & DB Repair", nameBn: "এমসিবি ও ডিবি মেরামত", nameBanglish: "MCB DB repair", keywords: ["mcb", "db box", "breaker", "trip", "distribution board"], emergency: true, durationMinutes: 60 },
    ],
  },
  {
    slug: "plumbing",
    nameEn: "Plumbing",
    nameBn: "প্লাম্বিং",
    nameBanglish: "Plumbing",
    icon: "droplet",
    keywords: ["plumber", "pipe", "water", "drain"],
    services: [
      { nameEn: "Plumber Visit", nameBn: "প্লাম্বার", nameBanglish: "Plumber", keywords: ["plumber", "plambur", "দলি", "pipe", "water pipe", "plumbing repair"], emergency: true, durationMinutes: 60 },
      { nameEn: "Tap & Faucet Repair", nameBn: "ট্যাপ মেরামত", nameBanglish: "Tap faucet repair", keywords: ["tap", "faucet", "nal", "bib", "cock"], durationMinutes: 45 },
      { nameEn: "Toilet & Flush Repair", nameBn: "টয়লেট ও ফ্লাশ মেরামত", nameBanglish: "Toilet flush repair", keywords: ["toilet", "flush", "commode", "block", "western", " indian toilet"], durationMinutes: 60 },
      { nameEn: "Water Pipe & Drain Repair", nameBn: "পানির পাইপ ও ড্রেন মেরামত", nameBanglish: "Water pipe drain repair", keywords: ["drain", "pipe", " blockage", "pipe burst", "drainage", "sewer"], emergency: true, durationMinutes: 90 },
      { nameEn: "Bathroom Fitting Installation", nameBn: "বাথরুম ফিটিং লাগানো", nameBanglish: "Bathroom fitting installation", keywords: ["bathroom", "shower", "bathtub", "fitting", "basin"], durationMinutes: 90 },
    ],
  },
  {
    slug: "appliance",
    nameEn: "Appliance Repair",
    nameBn: "গৃহস্থালি যন্ত্র মেরামত",
    nameBanglish: "Appliance repair",
    icon: "refrigerator",
    keywords: ["appliance", "fridge", "machine", "home appliance"],
    services: [
      { nameEn: "Refrigerator Repair", nameBn: "ফ্রিজ মেরামত", nameBanglish: "Fridge repair", keywords: ["fridge", "refrigerator", "freezer", "cold machine", "fridj"], emergency: true, durationMinutes: 90 },
      { nameEn: "Washing Machine Repair", nameBn: "ওয়াশিং মেশিন মেরামত", nameBanglish: "Washing machine repair", keywords: ["washing machine", "washer", "clothes machine"], durationMinutes: 90 },
      { nameEn: "Television Repair", nameBn: "টেলিভিশন মেরামত", nameBanglish: "TV repair", keywords: ["tv", "television", "led tv", "colour tv", "tv repair", "panel"], durationMinutes: 60 },
      { nameEn: "Microwave & Oven Repair", nameBn: "মাইক্রোওয়েভ ও ওভেন মেরামত", nameBanglish: "Microwave oven repair", keywords: ["microwave", "oven", "micro wave"], durationMinutes: 60 },
      { nameEn: "Water Purifier Service", nameBn: "ওয়াটার পিউরিফায়ার সার্ভিস", nameBanglish: "Water purifier service", keywords: ["water purifier", "filter", "ro", "water filter", "purifier"], durationMinutes: 60 },
    ],
  },
  {
    slug: "carpentry",
    nameEn: "Carpentry",
    nameBn: "কার্পেন্টারি",
    nameBanglish: "Carpentry",
    icon: "hammer",
    keywords: ["carpenter", "furniture", "wood", "door"],
    services: [
      { nameEn: "Furniture Repair", nameBn: "ফার্নিচার মেরামত", nameBanglish: "Furniture repair", keywords: ["furniture", "chair", "table", "almirah", "wood repair"], durationMinutes: 90 },
      { nameEn: "Door & Window Repair", nameBn: "দরজা ও জানালা মেরামত", nameBanglish: "Door window repair", keywords: ["door", "window", "gate", "door repair", "hinge"], durationMinutes: 90 },
      { nameEn: "Custom Furniture Making", nameBn: "কাস্টম ফার্নিচার তৈরি", nameBanglish: "Custom furniture", keywords: ["custom furniture", "making", "banano", "new furniture"], durationMinutes: 240 },
    ],
  },
  {
    slug: "painting",
    nameEn: "Painting",
    nameBn: "রঙের কাজ",
    nameBanglish: "Rang painting",
    icon: "paintbrush",
    keywords: ["painting", "paint", "colour"],
    services: [
      { nameEn: "Interior Wall Painting", nameBn: "ভেতরের দেয়ালে রঙ", nameBanglish: "Interior wall painting", keywords: ["painting", "paint", "wall paint", "rong", "reng", "interior painting"], durationMinutes: 240 },
      { nameEn: "Exterior Painting", nameBn: "বাইরের দেয়ালে রঙ", nameBanglish: "Exterior painting", keywords: ["exterior", "outside paint", "building paint"], durationMinutes: 300 },
      { nameEn: "Waterproofing", nameBn: "ওয়াটারপ্রুফিং", nameBanglish: "Waterproofing", keywords: ["waterproofing", "water proof", "leak", "drip", "ceiling leak", "chunu", "ছাদ"], durationMinutes: 240 },
    ],
  },
  {
    slug: "cleaning",
    nameEn: "Cleaning",
    nameBn: "পরিষ্কার সেবা",
    nameBanglish: "Cleaning",
    icon: "sparkles",
    keywords: ["cleaning", "clean", "house cleaning"],
    services: [
      { nameEn: "Full Home Cleaning", nameBn: "সম্পূর্ণ বাসা পরিষ্কার", nameBanglish: "Full home cleaning", keywords: ["cleaning", "deep cleaning", "house cleaning", "porishkar", "ghar cleaning"], durationMinutes: 240 },
      { nameEn: "Bathroom Cleaning", nameBn: "বাথরুম পরিষ্কার", nameBanglish: "Bathroom cleaning", keywords: ["bathroom cleaning", "toilet cleaning", "washroom"], durationMinutes: 90 },
      { nameEn: "Kitchen Deep Cleaning", nameBn: "রান্নাঘর গভীর পরিষ্কার", nameBanglish: "Kitchen deep cleaning", keywords: ["kitchen", "deep clean", "oil cleaning"], durationMinutes: 120 },
    ],
  },
  {
    slug: "locks",
    nameEn: "Door & Lock",
    nameBn: "তালা ও দরজা",
    nameBanglish: "Tala",
    icon: "lock",
    keywords: ["lock", "door", "key", "security"],
    services: [
      { nameEn: "Lock Repair & Installation", nameBn: "তালা মেরামত ও লাগানো", nameBanglish: "Lock repair installation", keywords: ["lock", "tala", "key", "door lock", "digital lock", "mortise"], emergency: true, durationMinutes: 45 },
      { nameEn: "Key Duplication", nameBn: "চাবি তৈরি", nameBanglish: "Key duplication", keywords: ["key", "duplicate key", "chabi", "key banano"], durationMinutes: 20 },
    ],
  },
  {
    slug: "pest-control",
    nameEn: "Pest Control",
    nameBn: "কীটনাশক সেবা",
    nameBanglish: "Pest control",
    icon: "shield",
    keywords: ["pest", "cockroach", "termite"],
    services: [
      { nameEn: "Cockroach Control", nameBn: "তেলাপোকা নিয়ন্ত্রণ", nameBanglish: "Cockroach control", keywords: ["cockroach", "roach", "telapoka", "roach control", "pest control"], durationMinutes: 90 },
      { nameEn: "Termite Control", nameBn: "টারমাইট নিয়ন্ত্রণ", nameBanglish: "Termite control", keywords: ["termite", "white ant", "termite control"], durationMinutes: 180 },
      { nameEn: "General Pest Control", nameBn: "সাধারণ কীট নিয়ন্ত্রণ", nameBanglish: "General pest control", keywords: ["pest control", "mosquito", "bedbug", "rat", "ants"], durationMinutes: 120 },
    ],
  },
  {
    slug: "construction",
    nameEn: "Construction & Masonry",
    nameBn: "নির্মাণ ও ইটকাজ",
    nameBanglish: "Construction",
    icon: "building",
    keywords: ["construction", "mason", "building", "wall"],
    services: [
      { nameEn: "Masonry & Wall Work", nameBn: "ইটকাজ ও দেয়ালের কাজ", nameBanglish: "Masonry wall work", keywords: ["mason", "rabi", "wall", "brick", "plaster", "ভাটা"], durationMinutes: 300 },
      { nameEn: "Tiling Work", nameBn: "টাইলসের কাজ", nameBanglish: "Tiling work", keywords: ["tile", "tiles", "tiling", "floor tile", "bathroom tile"], durationMinutes: 300 },
      { nameEn: "Ceiling Repair", nameBn: "সিলিং মেরামত", nameBanglish: "Ceiling repair", keywords: ["ceiling", "false ceiling", "pop", "ceiling repair"], durationMinutes: 180 },
      // Waterproofing deliberately lives under Painting only. Seeding it in two
      // categories would collide on the slug and silently overwrite one row.
      { nameEn: "Kitchen Cabinet Repair", nameBn: "রান্নাঘর ক্যাবিনেট মেরামত", nameBanglish: "Kitchen cabinet repair", keywords: ["cabinet", "kitchen", "cupboard", "counter"], durationMinutes: 120 },
    ],
  },
  {
    slug: "water-pump",
    nameEn: "Water & Pump",
    nameBn: "পানি ও পাম্প",
    nameBanglish: "Water pump",
    icon: "wrench",
    keywords: ["pump", "water", "motor", "tank"],
    services: [
      { nameEn: "Water Pump Repair", nameBn: "পানির পাম্প মেরামত", nameBanglish: "Water pump repair", keywords: ["pump", "water pump", "submersible", "motor", "pamp", "deep well"], emergency: true, durationMinutes: 90 },
      { nameEn: "Water Tank Cleaning", nameBn: "ওয়াটার ট্যাংক পরিষ্কার", nameBanglish: "Water tank cleaning", keywords: ["tank", "water tank", "tank cleaning", "overhead tank"], durationMinutes: 120 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seedLocations(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const [index, division] of DIVISIONS.entries()) {
    const terms = buildSearchTerms([division.nameEn, division.nameBn]);
    const record = await prisma.location.upsert({
      where: { slug: slugifyBangla(division.nameBn) },
      update: {
        nameEn: division.nameEn,
        nameBn: division.nameBn,
        searchText: terms.searchText,
        searchSkeleton: terms.searchSkeleton || null,
        latitude: division.lat,
        longitude: division.lng,
        sequence: index,
      },
      create: {
        type: "DIVISION",
        code: division.code,
        slug: slugifyBangla(division.nameBn),
        nameEn: division.nameEn,
        nameBn: division.nameBn,
        aliases: [],
        searchText: terms.searchText,
        searchSkeleton: terms.searchSkeleton || null,
        latitude: division.lat,
        longitude: division.lng,
        sequence: index,
      },
    });
    ids.set(division.code, record.id);
  }

  for (const [index, district] of DISTRICTS.entries()) {
    const divisionId = ids.get(district.division);
    if (!divisionId) continue;
    const terms = buildSearchTerms([district.nameEn, district.nameBn]);

    const record = await prisma.location.upsert({
      where: { slug: slugifyBangla(district.nameBn) },
      update: {
        nameEn: district.nameEn,
        nameBn: district.nameBn,
        searchText: terms.searchText,
        searchSkeleton: terms.searchSkeleton || null,
        latitude: district.lat,
        longitude: district.lng,
        sequence: index,
      },
      create: {
        type: "DISTRICT",
        code: district.code,
        parentId: divisionId,
        slug: slugifyBangla(district.nameBn),
        nameEn: district.nameEn,
        nameBn: district.nameBn,
        aliases: [],
        searchText: terms.searchText,
        searchSkeleton: terms.searchSkeleton || null,
        latitude: district.lat,
        longitude: district.lng,
        sequence: index,
      },
    });
    ids.set(district.code, record.id);

    for (const [areaIndex, area] of district.areas.entries()) {
      const terms2 = buildSearchTerms([
        area.nameEn,
        area.nameBn,
        area.aliases ?? [],
        district.nameEn,
      ]);
      const aliasTerms = (area.aliases ?? []).map((alias) => slugify(alias));

      await prisma.location.upsert({
        where: { slug: slugifyBangla(area.nameEn) },
        update: {
          nameEn: area.nameEn,
          nameBn: area.nameBn,
          aliases: area.aliases ?? [],
          searchText: terms2.searchText,
          searchSkeleton: terms2.searchSkeleton || null,
          latitude: area.lat,
          longitude: area.lng,
          sequence: areaIndex,
        },
        create: {
          type: "AREA",
          parentId: record.id,
          slug: slugifyBangla(area.nameEn),
          nameEn: area.nameEn,
          nameBn: area.nameBn,
          aliases: aliasTerms,
          searchText: terms2.searchText,
          searchSkeleton: terms2.searchSkeleton || null,
          latitude: area.lat,
          longitude: area.lng,
          sequence: areaIndex,
        },
      });
    }
  }

  return ids;
}

async function seedCatalogue(): Promise<void> {
  for (const [categoryIndex, category] of CATALOGUE.entries()) {
    const terms = buildSearchTerms([
      category.nameEn,
      category.nameBn,
      category.nameBanglish,
      category.keywords,
    ]);

    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        nameEn: category.nameEn,
        nameBn: category.nameBn,
        nameBanglish: category.nameBanglish,
        keywords: category.keywords,
        searchText: terms.searchText,
        searchSkeleton: terms.searchSkeleton || null,
        sequence: categoryIndex,
      },
      create: {
        slug: category.slug,
        nameEn: category.nameEn,
        nameBn: category.nameBn,
        nameBanglish: category.nameBanglish,
        icon: category.icon,
        keywords: category.keywords,
        searchText: terms.searchText,
        searchSkeleton: terms.searchSkeleton || null,
        sequence: categoryIndex,
        isPublished: true,
      },
    });

    for (const [serviceIndex, service] of category.services.entries()) {
      // Keywords are included in the indexed bag so a query like "plambur"
      // reaches the Plumber service through the alias, not only the name.
      const serviceTerms = buildSearchTerms([
        service.nameEn,
        service.nameBn,
        service.nameBanglish,
        service.keywords,
        category.nameEn,
      ]);

      await prisma.service.upsert({
        where: { slug: slugify(service.nameEn) },
        update: {
          nameEn: service.nameEn,
          nameBn: service.nameBn,
          nameBanglish: service.nameBanglish,
          keywords: service.keywords,
          searchText: serviceTerms.searchText,
          searchSkeleton: serviceTerms.searchSkeleton || null,
          isEmergency: service.emergency ?? false,
          durationMinutes: service.durationMinutes ?? 60,
          sequence: serviceIndex,
        },
        create: {
          categoryId: record.id,
          slug: slugify(service.nameEn),
          nameEn: service.nameEn,
          nameBn: service.nameBn,
          nameBanglish: service.nameBanglish,
          keywords: service.keywords,
          searchText: serviceTerms.searchText,
          searchSkeleton: serviceTerms.searchSkeleton || null,
          icon: record.icon,
          isEmergency: service.emergency ?? false,
          durationMinutes: service.durationMinutes ?? 60,
          sequence: serviceIndex,
          isPublished: true,
        },
      });
    }
  }
}

async function seedDefaults(): Promise<void> {
  // Business rules as data, so finance and support can change them without a
  // deploy. The application reads these and falls back to the same defaults in
  // packages/core if a key is missing.
  const settings: Array<{ key: string; value: unknown; group: string; description: string }> = [
    { key: "commission.defaultBps", value: 1200, group: "finance", description: "Fallback platform commission in basis points when no rule matches." },
    { key: "cancellation.freeCancelHours", value: 12, group: "finance", description: "Free cancellation up to this many hours before the appointment." },
    { key: "cancellation.lateCancelHours", value: 2, group: "finance", description: "Inside this window a visit fee applies." },
    { key: "cancellation.lateCancelFeePoisha", value: 20000, group: "finance", description: "Late cancellation visit fee." },
    { key: "cancellation.customerNoShowFeePoisha", value: 30000, group: "finance", description: "Fee retained when the customer does not attend." },
    { key: "booking.providerResponseMinutes", value: 30, group: "operations", description: "Minutes a provider has to respond before the request expires." },
    { key: "booking.autoCancelOnNoResponse", value: true, group: "operations", description: "Auto-cancel a request the provider never answers." },
    { key: "booking.allowOpenEndedQuotes", value: true, group: "operations", description: "Providers may quote a range and settle a final price on arrival." },
    { key: "review.windowDays", value: 14, group: "operations", description: "Days after completion a review may be left." },
    { key: "dispute.windowDays", value: 7, group: "support", description: "Days after completion a dispute may be opened." },
    { key: "referral.rewardPoisha", value: 5000, group: "growth", description: "Referral credit in poisha." },
    { key: "referral.enabled", value: false, group: "growth", description: "Referral programme is off until there is real supply to reward." },
    { key: "coupons.enabled", value: false, group: "growth", description: "Coupons are off until finance approves a funded campaign." },
    { key: "launch.cities", value: ["Dhaka"], group: "growth", description: "Cities currently open. Expand only where verified providers exist." },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { description: setting.description, group: setting.group },
      create: {
        key: setting.key,
        value: setting.value as never,
        group: setting.group,
        description: setting.description,
      },
    });
  }

  const rules = [
    { name: "Platform default", bps: 1200, serviceId: null, categoryId: null },
    { name: "AC & Cooling", bps: 1000, serviceId: null, categoryId: "ac-cooling" },
  ];

  for (const rule of rules) {
    const categoryId = rule.categoryId
      ? (await prisma.category.findUnique({ where: { slug: rule.categoryId } }))?.id ?? null
      : null;
    const exists = await prisma.commissionRule.findFirst({
      where: { name: rule.name, categoryId, serviceId: null },
    });
    if (!exists) {
      await prisma.commissionRule.create({
        data: { name: rule.name, commissionBps: rule.bps, categoryId },
      });
    }
  }
}

async function main(): Promise<void> {
  console.log("Seeding FixBondhu catalogue and reference data...\n");

  const locations = await seedLocations();
  console.log(`  locations   ${locations.size} divisions/districts + their areas`);

  await seedCatalogue();
  const [categories, services] = await Promise.all([
    prisma.category.count(),
    prisma.service.count(),
  ]);
  console.log(`  categories  ${categories}`);
  console.log(`  services    ${services}`);

  await seedDefaults();
  const settings = await prisma.setting.count();
  console.log(`  settings    ${settings}`);

  console.log(`
Done. No providers, bookings, reviews or statistics were created.

The marketplace is intentionally empty of supply and demand. Onboarding real
providers and real customers is what fills it, and nothing here is invented to
make the front page look populated.
`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
