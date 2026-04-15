/**
 * Seed Script — Populates the database with realistic US-based data
 *
 * Usage:  cd server && npm run seed
 *
 * Idempotent: finds existing records by name; creates only what's missing.
 * Order: Categories → SubCategories → Services → Vendors → VendorServices → Slots
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import moment from 'moment';

import Category from '../models/category.model';
import SubCategory from '../models/sub-category.model';
import Service from '../models/service.model';
import User from '../models/user.model';
import Vendor from '../models/vendor.model';
import VendorService from '../models/vendor-service.model';
import VendorServiceSlot from '../models/vendor-service-slot.model';

// ─── helpers ────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function findOrCreate<T extends mongoose.Document>(
  model: mongoose.Model<T>,
  query: Record<string, any>,
  data: Record<string, any>,
): Promise<T> {
  const existing = await model.findOne(query);
  if (existing) {
    console.log(`  ✓ exists — ${model.modelName}: ${JSON.stringify(query)}`);
    return existing;
  }
  const doc = await model.create(data);
  console.log(`  + created — ${model.modelName}: ${JSON.stringify(query)}`);
  return doc as T;
}

// ─── slot generation ────────────────────────────────────────────────────────
// Uses "from-to" timingType with a single timing per date (full availability window)
// matching the existing slot format in the database.

interface TimingRange {
  fromTime: string;
  toTime: string;
  reoccurrence: number;
}

interface SlotDateEntry {
  date: Date;
  reoccurrence: number;
  timingType: string;
  timings: TimingRange[];
}

interface SlotGroup {
  vendorServiceId: mongoose.Types.ObjectId;
  month: number;
  year: number;
  reoccurrence: number;
  dates: SlotDateEntry[];
}

function generateSlots(
  vendorServiceId: mongoose.Types.ObjectId,
  daysAhead: number,
  reoccurrence: number,
  weekdayTiming: TimingRange,
  saturdayTiming?: TimingRange,
): SlotGroup[] {
  const today = moment().startOf('day');
  const end = moment().add(daysAhead, 'days').startOf('day');

  const groups: Record<string, { month: number; year: number; dates: SlotDateEntry[] }> = {};

  const cursor = today.clone();
  while (cursor.isSameOrBefore(end)) {
    const dow = cursor.day(); // 0=Sun
    let timing: TimingRange | null = null;

    if (dow >= 1 && dow <= 5) {
      timing = weekdayTiming;
    } else if (dow === 6 && saturdayTiming) {
      timing = saturdayTiming;
    }

    if (timing) {
      const key = `${cursor.month()}-${cursor.year()}`;
      if (!groups[key]) {
        groups[key] = { month: cursor.month() + 1, year: cursor.year(), dates: [] };
      }
      groups[key].dates.push({
        date: new Date(cursor.format('YYYY-MM-DD')), // UTC midnight — matches server query format
        reoccurrence,
        timingType: 'from-to',
        timings: [
          { fromTime: timing.fromTime, toTime: timing.toTime, reoccurrence: timing.reoccurrence },
        ],
      });
    }

    cursor.add(1, 'day');
  }

  return Object.values(groups).map((g) => ({
    vendorServiceId,
    month: g.month,
    year: g.year,
    reoccurrence,
    dates: g.dates,
  }));
}

/**
 * Create slot documents — mirrors the vendor-portal controller pattern:
 * 1. Create document with the FIRST date (never empty dates[])
 * 2. Push additional dates one at a time via findById + push + save
 * This is the only approach that preserves nested timings in Cosmos DB.
 */
async function createSlotWithDates(group: SlotGroup): Promise<void> {
  if (group.dates.length === 0) return;

  // Step 1: Create with the first date (Cosmos DB needs data in nested arrays at creation)
  const firstDate = group.dates[0];
  const slotDoc = await VendorServiceSlot.create({
    vendorServiceId: group.vendorServiceId,
    month: group.month,
    year: group.year,
    reoccurrence: group.reoccurrence,
    dates: [
      {
        date: firstDate.date,
        reoccurrence: firstDate.reoccurrence,
        timingType: firstDate.timingType,
        timings: firstDate.timings,
      },
    ],
  });

  // Step 2: Push remaining dates one at a time (like the vendor-portal controller)
  for (let i = 1; i < group.dates.length; i++) {
    const dateEntry = group.dates[i];
    const doc = await VendorServiceSlot.findById(slotDoc._id);
    if (!doc) break;
    doc.dates.push({
      date: dateEntry.date,
      reoccurrence: dateEntry.reoccurrence,
      timingType: dateEntry.timingType,
      timings: dateEntry.timings,
    } as any);
    await doc.save();
    await delay(100);
  }
}

// ─── timing ranges (single from-to per date) ───────────────────────────────

// User spec: fromTime 09:30, toTime 17:30-19:30 depending on category
const WEEKDAY_DEFAULT: TimingRange = { fromTime: '09:30', toTime: '17:30', reoccurrence: 1 };
const WEEKDAY_LONG: TimingRange = { fromTime: '09:30', toTime: '19:30', reoccurrence: 1 }; // Towing, Air Quality
const SAT_DEFAULT: TimingRange = { fromTime: '09:30', toTime: '14:30', reoccurrence: 1 };
const BARBER_WEEKDAY: TimingRange = { fromTime: '09:30', toTime: '18:30', reoccurrence: 2 };
const BARBER_SAT: TimingRange = { fromTime: '09:30', toTime: '14:30', reoccurrence: 2 };

// ─── data definitions ───────────────────────────────────────────────────────

interface SubCatDef {
  name: string;
  description: string;
}

interface ServiceDef {
  name: string;
  description: string;
  subCategory: string;
}

interface VendorDef {
  vendorName: string;
  serviceProviderName: string;
  aboutDescription: string;
  country: string;
  state: string;
  city: string;
  zip: string;
  address1: string;
  email: string;
  phone: string;
  rating: number;
  tags: string[];
  category: string;
}

interface VendorServiceDef {
  vendorName: string;
  serviceName: string;
  name: string;
  subTitle: string;
  shortDescriptionType: string;
  shortDescription: string[];
  description: { title: string; type: string; content: string[] }[];
  image: string;
  price: number;
  duration: number;
  servicePlace: string;
  tags: string[];
  rating: number;
}

// ─── categories ─────────────────────────────────────────────────────────────

const CATEGORIES = ['Accounting', 'Air Quality', 'Barber', 'Lawyer', 'Tailoring', 'Towing'];

// ─── sub-categories ─────────────────────────────────────────────────────────

const SUB_CATEGORIES: Record<string, SubCatDef[]> = {
  Accounting: [
    { name: 'Audit', description: 'Financial and compliance audit services' },
    {
      name: 'Small Business Accounting',
      description: 'Bookkeeping, payroll and tax services for small businesses',
    },
  ],
  'Air Quality': [
    {
      name: 'Air Filtration',
      description: 'HVAC filter replacement and air purifier installation',
    },
    { name: 'Home Air Assessment', description: 'Indoor air quality and radon testing' },
  ],
  Barber: [
    { name: 'A Wax', description: 'Waxing services' },
    { name: 'Afro Trim', description: 'Afro-style haircuts and trims' },
    { name: 'Brow Maintenance', description: 'Eyebrow shaping and grooming' },
  ],
  Lawyer: [
    { name: 'Legal Consultations', description: 'Business, contract and estate legal advice' },
    {
      name: 'Immigration Consultation',
      description: 'Visa, green card and citizenship consultation',
    },
  ],
  Tailoring: [
    { name: 'Alterations', description: 'Clothing alterations and adjustments' },
    { name: 'Custom Tailoring', description: 'Bespoke suits and custom garments' },
  ],
  Towing: [
    { name: 'Local Towing', description: 'Local vehicle towing and roadside assistance' },
    { name: 'Hauling', description: 'Junk removal and equipment hauling' },
  ],
};

// ─── services ───────────────────────────────────────────────────────────────

const SERVICES: Record<string, ServiceDef[]> = {
  Accounting: [
    {
      name: 'Financial Statement Audit',
      description: 'Comprehensive audit of financial statements for compliance and accuracy',
      subCategory: 'Audit',
    },
    {
      name: 'Internal Audit Review',
      description: 'Internal controls assessment and process improvement recommendations',
      subCategory: 'Audit',
    },
    {
      name: 'Tax Audit Representation',
      description: 'Professional representation during IRS or state tax audits',
      subCategory: 'Audit',
    },
    {
      name: 'Monthly Bookkeeping',
      description: 'Ongoing monthly bookkeeping and financial record management',
      subCategory: 'Small Business Accounting',
    },
    {
      name: 'Quarterly Tax Preparation',
      description: 'Quarterly estimated tax calculation and filing',
      subCategory: 'Small Business Accounting',
    },
    {
      name: 'Payroll Processing',
      description: 'Employee payroll calculation, tax withholding and direct deposit',
      subCategory: 'Small Business Accounting',
    },
  ],
  'Air Quality': [
    {
      name: 'HVAC Filter Replacement',
      description: 'Professional replacement of HVAC system air filters',
      subCategory: 'Air Filtration',
    },
    {
      name: 'Air Purifier Installation',
      description: 'Whole-home or room air purifier setup and installation',
      subCategory: 'Air Filtration',
    },
    {
      name: 'Duct Cleaning',
      description: 'Complete air duct cleaning and sanitization',
      subCategory: 'Air Filtration',
    },
    {
      name: 'Indoor Air Quality Testing',
      description: 'Comprehensive indoor air quality analysis and report',
      subCategory: 'Home Air Assessment',
    },
    {
      name: 'Radon Testing',
      description: 'EPA-compliant radon level testing for residential properties',
      subCategory: 'Home Air Assessment',
    },
  ],
  Barber: [
    { name: 'Full Leg Wax', description: 'Complete leg waxing service', subCategory: 'A Wax' },
    { name: 'Arm Wax', description: 'Full arm waxing service', subCategory: 'A Wax' },
    { name: 'Back Wax', description: 'Full back waxing service', subCategory: 'A Wax' },
    {
      name: 'Classic Afro Shape-Up',
      description: 'Traditional afro haircut with clean shape-up',
      subCategory: 'Afro Trim',
    },
    {
      name: 'Afro Taper Fade',
      description: 'Afro with tapered fade on sides',
      subCategory: 'Afro Trim',
    },
    {
      name: 'Eyebrow Threading',
      description: 'Precise eyebrow shaping using threading technique',
      subCategory: 'Brow Maintenance',
    },
    {
      name: 'Eyebrow Wax & Shape',
      description: 'Brow waxing with detailed shaping',
      subCategory: 'Brow Maintenance',
    },
  ],
  Lawyer: [
    {
      name: 'Business Formation Consultation',
      description: 'Guidance on LLC, Corp, or partnership formation',
      subCategory: 'Legal Consultations',
    },
    {
      name: 'Contract Review',
      description: 'Legal review and analysis of business contracts',
      subCategory: 'Legal Consultations',
    },
    {
      name: 'Estate Planning Consultation',
      description: 'Will, trust and estate planning advisory session',
      subCategory: 'Legal Consultations',
    },
    {
      name: 'Visa Application Consultation',
      description: 'Work, student or family visa application guidance',
      subCategory: 'Immigration Consultation',
    },
    {
      name: 'Green Card Consultation',
      description: 'Permanent residency application process consultation',
      subCategory: 'Immigration Consultation',
    },
    {
      name: 'Citizenship & Naturalization',
      description: 'US citizenship application and naturalization guidance',
      subCategory: 'Immigration Consultation',
    },
  ],
  Tailoring: [
    {
      name: 'Hem Adjustment',
      description: 'Pants, skirt or dress hem alteration',
      subCategory: 'Alterations',
    },
    {
      name: 'Suit Fitting & Alteration',
      description: 'Professional suit fitting with adjustments',
      subCategory: 'Alterations',
    },
    {
      name: 'Dress Alteration',
      description: 'Dress resizing, hemming or restructuring',
      subCategory: 'Alterations',
    },
    {
      name: 'Custom Suit',
      description: 'Bespoke suit tailored to exact measurements',
      subCategory: 'Custom Tailoring',
    },
    {
      name: 'Custom Dress Shirt',
      description: 'Made-to-measure dress shirt',
      subCategory: 'Custom Tailoring',
    },
  ],
  Towing: [
    {
      name: 'Standard Vehicle Tow',
      description: 'Local towing for cars and light trucks',
      subCategory: 'Local Towing',
    },
    {
      name: 'Flatbed Towing',
      description: 'Flatbed tow for luxury, AWD or damaged vehicles',
      subCategory: 'Local Towing',
    },
    {
      name: 'Motorcycle Towing',
      description: 'Safe motorcycle transport via flatbed or trailer',
      subCategory: 'Local Towing',
    },
    {
      name: 'Junk Vehicle Removal',
      description: 'Free removal of non-running junk vehicles',
      subCategory: 'Hauling',
    },
    {
      name: 'Equipment Hauling',
      description: 'Heavy equipment and machinery transport',
      subCategory: 'Hauling',
    },
  ],
};

// ─── vendors ────────────────────────────────────────────────────────────────

const VENDORS: VendorDef[] = [
  {
    vendorName: 'Summit Financial Group',
    serviceProviderName: 'David Henderson, CPA',
    aboutDescription:
      'Summit Financial Group has provided trusted accounting and audit services to businesses across Texas since 2008. Our team of certified CPAs delivers accurate, timely financial guidance.',
    country: 'US',
    state: 'TX',
    city: 'Austin',
    zip: '78701',
    address1: '401 Congress Ave, Suite 1540',
    email: 'info@summitfinancialgroup.com',
    phone: '(512) 555-0142',
    rating: 4.8,
    tags: ['accounting', 'audit', 'tax', 'cpa'],
    category: 'Accounting',
  },
  {
    vendorName: 'Precision Ledger Accounting',
    serviceProviderName: 'Sarah Mitchell',
    aboutDescription:
      'Precision Ledger specializes in small business accounting, bookkeeping and payroll services. We help entrepreneurs focus on growth while we handle the numbers.',
    country: 'US',
    state: 'CO',
    city: 'Denver',
    zip: '80202',
    address1: '1700 Lincoln St, Suite 2800',
    email: 'hello@precisionledger.com',
    phone: '(303) 555-0198',
    rating: 4.6,
    tags: ['bookkeeping', 'payroll', 'small-business', 'tax'],
    category: 'Accounting',
  },
  {
    vendorName: 'CleanAir Solutions',
    serviceProviderName: 'Michael Torres',
    aboutDescription:
      "CleanAir Solutions is Arizona's premier indoor air quality company. We provide HVAC filtration, duct cleaning and air purifier installation for healthier homes.",
    country: 'US',
    state: 'AZ',
    city: 'Scottsdale',
    zip: '85251',
    address1: '7150 E Camelback Rd, Suite 210',
    email: 'service@cleanairsolutions.com',
    phone: '(480) 555-0167',
    rating: 4.7,
    tags: ['air-quality', 'hvac', 'filtration', 'duct-cleaning'],
    category: 'Air Quality',
  },
  {
    vendorName: 'BreatheWell Environmental',
    serviceProviderName: 'Jessica Park',
    aboutDescription:
      'BreatheWell Environmental offers comprehensive indoor air testing and assessment services. Our EPA-certified technicians ensure your home air is safe and clean.',
    country: 'US',
    state: 'GA',
    city: 'Atlanta',
    zip: '30309',
    address1: '1100 Peachtree St NE, Suite 600',
    email: 'test@breathewell.com',
    phone: '(404) 555-0234',
    rating: 4.5,
    tags: ['air-testing', 'radon', 'environmental', 'assessment'],
    category: 'Air Quality',
  },
  {
    vendorName: 'Sharp Edge Barbershop',
    serviceProviderName: 'Marcus Johnson',
    aboutDescription:
      'Sharp Edge Barbershop is a modern grooming studio in Los Angeles offering premium haircuts, waxing and brow services. Walk-ins welcome.',
    country: 'US',
    state: 'CA',
    city: 'Los Angeles',
    zip: '90015',
    address1: '888 S Figueroa St, Suite 120',
    email: 'book@sharpedgebarbershop.com',
    phone: '(213) 555-0312',
    rating: 4.9,
    tags: ['barber', 'haircut', 'waxing', 'grooming'],
    category: 'Barber',
  },
  {
    vendorName: 'Metro Grooming Lounge',
    serviceProviderName: 'Anthony Williams',
    aboutDescription:
      'Metro Grooming Lounge in Chicago provides expert barber services including afro trims, waxing, threading and beard grooming in a relaxed atmosphere.',
    country: 'US',
    state: 'IL',
    city: 'Chicago',
    zip: '60601',
    address1: '150 N Michigan Ave, Suite 300',
    email: 'appointments@metrogrooming.com',
    phone: '(312) 555-0189',
    rating: 4.7,
    tags: ['barber', 'grooming', 'afro', 'threading'],
    category: 'Barber',
  },
  {
    vendorName: 'Harrison & Cole Law Firm',
    serviceProviderName: 'Robert Harrison, Esq.',
    aboutDescription:
      'Harrison & Cole is a New York-based law firm specializing in business formation, contract law and estate planning. Over 20 years of legal excellence.',
    country: 'US',
    state: 'NY',
    city: 'New York',
    zip: '10017',
    address1: '350 Fifth Avenue, Suite 4210',
    email: 'contact@harrisoncole.com',
    phone: '(212) 555-0276',
    rating: 4.8,
    tags: ['lawyer', 'business-law', 'estate-planning', 'contracts'],
    category: 'Lawyer',
  },
  {
    vendorName: 'Liberty Immigration Law',
    serviceProviderName: 'Ana Rodriguez, Esq.',
    aboutDescription:
      'Liberty Immigration Law helps individuals and families navigate US immigration including visas, green cards and citizenship. Bilingual English/Spanish services.',
    country: 'US',
    state: 'FL',
    city: 'Miami',
    zip: '33131',
    address1: '200 S Biscayne Blvd, Suite 2500',
    email: 'info@libertyimmigration.com',
    phone: '(305) 555-0345',
    rating: 4.9,
    tags: ['immigration', 'visa', 'green-card', 'citizenship'],
    category: 'Lawyer',
  },
  {
    vendorName: 'Pacific Legal Advisors',
    serviceProviderName: 'James Chen, Esq.',
    aboutDescription:
      'Pacific Legal Advisors provides comprehensive legal services in San Francisco, from business formation to immigration. Client-focused approach with competitive rates.',
    country: 'US',
    state: 'CA',
    city: 'San Francisco',
    zip: '94111',
    address1: '555 California St, Suite 3200',
    email: 'inquiries@pacificlegal.com',
    phone: '(415) 555-0423',
    rating: 4.6,
    tags: ['lawyer', 'business-formation', 'immigration', 'contracts'],
    category: 'Lawyer',
  },
  {
    vendorName: 'Master Stitch Tailors',
    serviceProviderName: 'Giovanni Russo',
    aboutDescription:
      'Master Stitch Tailors in Houston has been crafting perfect fits since 1995. Expert alterations and custom tailoring for men and women.',
    country: 'US',
    state: 'TX',
    city: 'Houston',
    zip: '77002',
    address1: '910 Main St, Suite 100',
    email: 'appointments@masterstitchtailors.com',
    phone: '(713) 555-0156',
    rating: 4.8,
    tags: ['tailoring', 'alterations', 'custom-suit', 'bespoke'],
    category: 'Tailoring',
  },
  {
    vendorName: 'Thread & Needle Bespoke',
    serviceProviderName: 'Emily Nakamura',
    aboutDescription:
      "Thread & Needle Bespoke is Seattle's top destination for custom suits and precision alterations. We combine traditional craftsmanship with modern style.",
    country: 'US',
    state: 'WA',
    city: 'Seattle',
    zip: '98101',
    address1: '1420 Fifth Ave, Suite 200',
    email: 'hello@threadandneedle.com',
    phone: '(206) 555-0287',
    rating: 4.7,
    tags: ['tailoring', 'bespoke', 'alterations', 'custom-shirts'],
    category: 'Tailoring',
  },
  {
    vendorName: 'Rapid Response Towing',
    serviceProviderName: 'Jake Morrison',
    aboutDescription:
      'Rapid Response Towing offers 24/7 towing and roadside assistance across the Dallas-Fort Worth metroplex. Fast, reliable and affordable.',
    country: 'US',
    state: 'TX',
    city: 'Dallas',
    zip: '75201',
    address1: '2200 Ross Ave, Suite 4100',
    email: 'dispatch@rapidresponsetowing.com',
    phone: '(214) 555-0398',
    rating: 4.6,
    tags: ['towing', 'roadside', 'flatbed', 'emergency'],
    category: 'Towing',
  },
  {
    vendorName: 'Metro Tow & Haul',
    serviceProviderName: 'Brian Kelly',
    aboutDescription:
      'Metro Tow & Haul provides professional towing, junk vehicle removal and equipment hauling throughout the Portland metro area.',
    country: 'US',
    state: 'OR',
    city: 'Portland',
    zip: '97204',
    address1: '620 SW Fifth Ave, Suite 300',
    email: 'service@metrotowhaul.com',
    phone: '(503) 555-0412',
    rating: 4.5,
    tags: ['towing', 'hauling', 'junk-removal', 'equipment'],
    category: 'Towing',
  },
];

// ─── vendor users (Clerk) ───────────────────────────────────────────────────

interface VendorUserDef {
  vendorName: string;
  firstName: string;
  lastName: string;
  email: string;
  clerkId: string;
}

const VENDOR_USERS: VendorUserDef[] = [
  {
    vendorName: 'Summit Financial Group',
    firstName: 'David',
    lastName: 'Henderson',
    email: 'info@summitfinancialgroup.com',
    clerkId: 'user_3Avgj8cSAn5806iEkf2UYaGZiZq',
  },
  {
    vendorName: 'Precision Ledger Accounting',
    firstName: 'Sarah',
    lastName: 'Mitchell',
    email: 'hello@precisionledger.com',
    clerkId: 'user_3AvgrswVRWp54UErIJPP8bMwAV5',
  },
  {
    vendorName: 'CleanAir Solutions',
    firstName: 'Michael',
    lastName: 'Torres',
    email: 'service@cleanairsolutions.com',
    clerkId: 'user_3Avh5iPP2f6qteYvk5MQ8Je7Z6T',
  },
  {
    vendorName: 'BreatheWell Environmental',
    firstName: 'Jessica',
    lastName: 'Park',
    email: 'test@breathewell.com',
    clerkId: 'user_3AvhElJ5lPs0SMegyQEsOY0JBTO',
  },
  {
    vendorName: 'Sharp Edge Barbershop',
    firstName: 'Marcus',
    lastName: 'Johnson',
    email: 'book@sharpedgebarbershop.com',
    clerkId: 'user_3ArTKz8uqB8tQiBQ5cPyGhNUYY8',
  },
  {
    vendorName: 'Metro Grooming Lounge',
    firstName: 'Anthony',
    lastName: 'Williams',
    email: 'appointments@metrogrooming.com',
    clerkId: 'user_3AwpboIlyiyMjQW1a5gOY774y5s',
  },
  {
    vendorName: 'Harrison & Cole Law Firm',
    firstName: 'Robert',
    lastName: 'Harrison',
    email: 'contact@harrisoncole.com',
    clerkId: 'user_3AwpiXPArO2TaRwXBbY1hlRxNkf',
  },
  {
    vendorName: 'Liberty Immigration Law',
    firstName: 'Ana',
    lastName: 'Rodriguez',
    email: 'info@libertyimmigration.com',
    clerkId: 'user_3AwtKJ1iNazDuYUIMIMmgDp7Oyo',
  },
  {
    vendorName: 'Pacific Legal Advisors',
    firstName: 'James',
    lastName: 'Chen',
    email: 'inquiries@pacificlegal.com',
    clerkId: 'user_3AwtUqvx38seWYBnpOvElObGbtn',
  },
  {
    vendorName: 'Master Stitch Tailors',
    firstName: 'Giovanni',
    lastName: 'Russo',
    email: 'appointments@masterstitchtailors.com',
    clerkId: 'user_3AwtezrDoHx4rkLy8FtaRo2RMKE',
  },
  {
    vendorName: 'Thread & Needle Bespoke',
    firstName: 'Emily',
    lastName: 'Nakamura',
    email: 'hello@threadandneedle.com',
    clerkId: 'user_3AwuRyzCm4L2b1RjTe2byZCjZfw',
  },
  {
    vendorName: 'Rapid Response Towing',
    firstName: 'Jake',
    lastName: 'Morrison',
    email: 'dispatch@rapidresponsetowing.com',
    clerkId: 'user_3AwuaYPddW6wdC70RmKLJ5P6Gqx',
  },
  {
    vendorName: 'Metro Tow & Haul',
    firstName: 'Brian',
    lastName: 'Kelly',
    email: 'service@metrotowhaul.com',
    clerkId: 'user_3AwuhGmHycnub4RWe2pKIiKkt6r',
  },
];

// ─── vendor services ────────────────────────────────────────────────────────

const VENDOR_SERVICES: VendorServiceDef[] = [
  // ── Accounting ─────────────────────────
  {
    vendorName: 'Summit Financial Group',
    serviceName: 'Financial Statement Audit',
    name: 'Financial Statement Audit',
    subTitle: 'Comprehensive GAAP-compliant audit',
    shortDescriptionType: 'list',
    shortDescription: [
      'Full GAAP-compliant financial statement review',
      'Risk assessment and internal controls evaluation',
      'Detailed audit report with findings',
      'Management letter with recommendations',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Complete review of balance sheet, income statement and cash flow',
          'Internal controls assessment',
          'Detailed written report',
          'Follow-up meeting to discuss findings',
        ],
      },
      {
        title: "Who It's For",
        type: 'paragraph',
        content: [
          'This service is ideal for businesses seeking annual audits for compliance, investor confidence or loan requirements.',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1762427354397-854a52e0ded7?w=400&h=300&fit=crop',
    price: 350,
    duration: 120,
    servicePlace: 'both',
    tags: ['audit', 'financial', 'gaap', 'compliance'],
    rating: 4.8,
  },
  {
    vendorName: 'Summit Financial Group',
    serviceName: 'Internal Audit Review',
    name: 'Internal Audit Review',
    subTitle: 'Internal controls assessment',
    shortDescriptionType: 'list',
    shortDescription: [
      'Evaluation of internal financial controls',
      'Process improvement recommendations',
      'Fraud risk assessment',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Review of key financial processes',
          'Risk matrix creation',
          'Actionable improvement plan',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1675242314995-034d11bac319?w=400&h=300&fit=crop',
    price: 275,
    duration: 90,
    servicePlace: 'both',
    tags: ['internal-audit', 'controls', 'risk'],
    rating: 4.7,
  },
  {
    vendorName: 'Summit Financial Group',
    serviceName: 'Tax Audit Representation',
    name: 'Tax Audit Representation',
    subTitle: 'IRS & state audit defense',
    shortDescriptionType: 'list',
    shortDescription: [
      'Professional representation before IRS or state agencies',
      'Document preparation and organization',
      'Negotiation and settlement support',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Initial case review',
          'Document gathering and preparation',
          'Representation at audit meetings',
          'Post-audit follow-up',
        ],
      },
    ],
    image:
      'https://plus.unsplash.com/premium_photo-1664298878256-50c990243a94?w=400&h=300&fit=crop',
    price: 400,
    duration: 90,
    servicePlace: 'both',
    tags: ['tax-audit', 'irs', 'representation'],
    rating: 4.9,
  },
  {
    vendorName: 'Precision Ledger Accounting',
    serviceName: 'Monthly Bookkeeping',
    name: 'Monthly Bookkeeping',
    subTitle: 'Ongoing financial record management',
    shortDescriptionType: 'list',
    shortDescription: [
      'Transaction categorization and reconciliation',
      'Monthly financial statements',
      'Accounts payable and receivable tracking',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Bank and credit card reconciliation',
          'Profit & loss statement',
          'Balance sheet',
          'Monthly summary email',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1675242314995-034d11bac319?w=400&h=300&fit=crop',
    price: 200,
    duration: 60,
    servicePlace: 'both',
    tags: ['bookkeeping', 'monthly', 'reconciliation'],
    rating: 4.6,
  },
  {
    vendorName: 'Precision Ledger Accounting',
    serviceName: 'Quarterly Tax Preparation',
    name: 'Quarterly Tax Preparation',
    subTitle: 'Estimated tax calculation & filing',
    shortDescriptionType: 'list',
    shortDescription: [
      'Quarterly estimated tax calculation',
      'Federal and state filing preparation',
      'Tax liability minimization strategies',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Income and deduction review',
          'Estimated payment vouchers',
          'Filing reminders and deadlines tracking',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1762427354397-854a52e0ded7?w=400&h=300&fit=crop',
    price: 150,
    duration: 60,
    servicePlace: 'both',
    tags: ['tax', 'quarterly', 'estimated-tax'],
    rating: 4.5,
  },
  {
    vendorName: 'Precision Ledger Accounting',
    serviceName: 'Payroll Processing',
    name: 'Payroll Processing',
    subTitle: 'Complete payroll management',
    shortDescriptionType: 'list',
    shortDescription: [
      'Employee wage calculation',
      'Tax withholding and deposits',
      'Direct deposit setup and management',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Payroll processing for up to 20 employees',
          'W-2 and 1099 preparation',
          'Tax deposit scheduling',
          'Year-end payroll reports',
        ],
      },
    ],
    image:
      'https://plus.unsplash.com/premium_photo-1664298878256-50c990243a94?w=400&h=300&fit=crop',
    price: 125,
    duration: 45,
    servicePlace: 'vendor',
    tags: ['payroll', 'wages', 'direct-deposit'],
    rating: 4.6,
  },

  // ── Air Quality ────────────────────────
  {
    vendorName: 'CleanAir Solutions',
    serviceName: 'HVAC Filter Replacement',
    name: 'HVAC Filter Replacement',
    subTitle: 'Professional filter swap & inspection',
    shortDescriptionType: 'list',
    shortDescription: [
      'High-efficiency MERV-rated filter installation',
      'HVAC system inspection during service',
      'Improved air flow and energy efficiency',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Filter sizing and selection',
          'Professional installation',
          'System airflow check',
          'Filter replacement schedule recommendation',
        ],
      },
    ],
    image:
      'https://plus.unsplash.com/premium_photo-1666788168004-794f629d15d3?w=400&h=300&fit=crop',
    price: 89,
    duration: 45,
    servicePlace: 'customer',
    tags: ['hvac', 'filter', 'air-quality'],
    rating: 4.7,
  },
  {
    vendorName: 'CleanAir Solutions',
    serviceName: 'Air Purifier Installation',
    name: 'Air Purifier Installation',
    subTitle: 'Whole-home purifier setup',
    shortDescriptionType: 'list',
    shortDescription: [
      'HEPA or UV-C purifier installation',
      'Integration with existing HVAC system',
      'Post-installation air quality verification',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Equipment selection consultation',
          'Professional installation',
          'System integration and testing',
          'User guide walkthrough',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1768471569643-717e823b5f9a?w=400&h=300&fit=crop',
    price: 249,
    duration: 120,
    servicePlace: 'customer',
    tags: ['air-purifier', 'hepa', 'installation'],
    rating: 4.8,
  },
  {
    vendorName: 'CleanAir Solutions',
    serviceName: 'Duct Cleaning',
    name: 'Duct Cleaning',
    subTitle: 'Complete duct system cleaning',
    shortDescriptionType: 'list',
    shortDescription: [
      'Full air duct system cleaning',
      'Removal of dust, allergens and debris',
      'Sanitization treatment included',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Inspection of all ductwork',
          'HEPA-vacuum cleaning',
          'Antimicrobial sanitization',
          'Before and after photos',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1601659404194-97d2daca8383?w=400&h=300&fit=crop',
    price: 199,
    duration: 180,
    servicePlace: 'customer',
    tags: ['duct-cleaning', 'sanitization', 'allergens'],
    rating: 4.6,
  },
  {
    vendorName: 'BreatheWell Environmental',
    serviceName: 'Indoor Air Quality Testing',
    name: 'Indoor Air Quality Testing',
    subTitle: 'Comprehensive IAQ analysis',
    shortDescriptionType: 'list',
    shortDescription: [
      'Testing for VOCs, mold spores and particulates',
      'CO2 and humidity level monitoring',
      'Detailed report with remediation plan',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Multi-point sampling throughout home',
          'Lab analysis of air samples',
          'Written report with EPA comparison',
          'Remediation recommendations',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1759646827242-cf09e30709aa?w=400&h=300&fit=crop',
    price: 175,
    duration: 90,
    servicePlace: 'customer',
    tags: ['air-testing', 'iaq', 'voc', 'mold'],
    rating: 4.5,
  },
  {
    vendorName: 'BreatheWell Environmental',
    serviceName: 'Radon Testing',
    name: 'Radon Testing',
    subTitle: 'EPA-compliant radon analysis',
    shortDescriptionType: 'list',
    shortDescription: [
      '48-hour continuous radon monitoring',
      'EPA-compliant testing methodology',
      'Results within 3 business days',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Continuous radon monitor placement',
          '48-hour data collection',
          'Lab-certified results report',
          'Mitigation referral if needed',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1765153155226-f617921051b3?w=400&h=300&fit=crop',
    price: 150,
    duration: 60,
    servicePlace: 'customer',
    tags: ['radon', 'epa', 'testing', 'residential'],
    rating: 4.4,
  },

  // ── Barber ─────────────────────────────
  {
    vendorName: 'Sharp Edge Barbershop',
    serviceName: 'Full Leg Wax',
    name: 'Full Leg Wax',
    subTitle: 'Smooth legs, professional care',
    shortDescriptionType: 'list',
    shortDescription: [
      'Complete upper and lower leg waxing',
      'Premium hypoallergenic wax',
      'Post-wax soothing treatment',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Full leg wax (ankle to hip)',
          'Pre-wax skin prep',
          'Soothing aloe application',
          'Aftercare instructions',
        ],
      },
    ],
    image:
      'https://plus.unsplash.com/premium_photo-1664187387480-c1a590186a96?w=400&h=300&fit=crop',
    price: 65,
    duration: 45,
    servicePlace: 'vendor',
    tags: ['waxing', 'leg-wax', 'grooming'],
    rating: 4.8,
  },
  {
    vendorName: 'Sharp Edge Barbershop',
    serviceName: 'Classic Afro Shape-Up',
    name: 'Classic Afro Shape-Up',
    subTitle: 'Clean afro with sharp line-up',
    shortDescriptionType: 'list',
    shortDescription: ['Precision afro shaping', 'Clean hairline and edge-up', 'Hot towel finish'],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Consultation on shape and length',
          'Afro cut and shape',
          'Edge-up and line work',
          'Hot towel and moisturizer',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=400&h=300&fit=crop',
    price: 40,
    duration: 30,
    servicePlace: 'vendor',
    tags: ['afro', 'shape-up', 'haircut'],
    rating: 4.9,
  },
  {
    vendorName: 'Sharp Edge Barbershop',
    serviceName: 'Eyebrow Threading',
    name: 'Eyebrow Threading',
    subTitle: 'Precise brow shaping',
    shortDescriptionType: 'list',
    shortDescription: [
      'Clean precise eyebrow shaping',
      'Threading technique for fine detail',
      'Quick and gentle process',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: ['Brow consultation', 'Threading shaping', 'Soothing gel application'],
      },
    ],
    image: 'https://images.unsplash.com/photo-1570386061001-2b0892eb354b?w=400&h=300&fit=crop',
    price: 15,
    duration: 15,
    servicePlace: 'vendor',
    tags: ['eyebrow', 'threading', 'brow'],
    rating: 4.8,
  },
  {
    vendorName: 'Metro Grooming Lounge',
    serviceName: 'Afro Taper Fade',
    name: 'Afro Taper Fade',
    subTitle: 'Modern afro with tapered sides',
    shortDescriptionType: 'list',
    shortDescription: [
      'Afro top with gradual taper fade',
      'Precision clipper work',
      'Clean neckline and edge-up',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Style consultation',
          'Taper fade cut',
          'Afro shaping on top',
          'Line-up and neckline cleanup',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1633990700440-30a1f452a95b?w=400&h=300&fit=crop',
    price: 45,
    duration: 30,
    servicePlace: 'vendor',
    tags: ['afro', 'taper-fade', 'haircut'],
    rating: 4.7,
  },
  {
    vendorName: 'Metro Grooming Lounge',
    serviceName: 'Eyebrow Wax & Shape',
    name: 'Eyebrow Wax & Shape',
    subTitle: 'Defined brows with wax',
    shortDescriptionType: 'list',
    shortDescription: [
      'Wax-based eyebrow shaping',
      'Detailed arch definition',
      'Quick 15-minute service',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: ['Brow analysis', 'Warm wax application', 'Shaping and cleanup', 'Aloe aftercare'],
      },
    ],
    image: 'https://images.unsplash.com/photo-1613829782925-2062b413d760?w=400&h=300&fit=crop',
    price: 20,
    duration: 15,
    servicePlace: 'vendor',
    tags: ['eyebrow', 'wax', 'shaping'],
    rating: 4.6,
  },
  {
    vendorName: 'Metro Grooming Lounge',
    serviceName: 'Arm Wax',
    name: 'Arm Wax',
    subTitle: 'Full arm waxing service',
    shortDescriptionType: 'list',
    shortDescription: [
      'Complete arm waxing from wrist to shoulder',
      'Premium warm wax formula',
      'Smooth results lasting 3-4 weeks',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Full arm wax',
          'Pre-wax cleansing',
          'Post-wax soothing lotion',
          'Aftercare tips',
        ],
      },
    ],
    image:
      'https://plus.unsplash.com/premium_photo-1664187387394-4be792b3035d?w=400&h=300&fit=crop',
    price: 45,
    duration: 30,
    servicePlace: 'vendor',
    tags: ['waxing', 'arm-wax', 'grooming'],
    rating: 4.7,
  },

  // ── Lawyer ─────────────────────────────
  {
    vendorName: 'Harrison & Cole Law Firm',
    serviceName: 'Business Formation Consultation',
    name: 'Business Formation Consultation',
    subTitle: 'LLC, Corp & partnership guidance',
    shortDescriptionType: 'list',
    shortDescription: [
      'Entity type comparison (LLC, S-Corp, C-Corp)',
      'State filing requirements review',
      'Operating agreement overview',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          '1-hour consultation with attorney',
          'Entity comparison worksheet',
          'Next steps checklist',
          'Follow-up email summary',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1767972159871-b9f5d320be2b?w=400&h=300&fit=crop',
    price: 250,
    duration: 60,
    servicePlace: 'vendor',
    tags: ['business-formation', 'llc', 'incorporation'],
    rating: 4.8,
  },
  {
    vendorName: 'Harrison & Cole Law Firm',
    serviceName: 'Contract Review',
    name: 'Contract Review & Analysis',
    subTitle: 'Thorough contract evaluation',
    shortDescriptionType: 'list',
    shortDescription: [
      'Line-by-line contract analysis',
      'Risk identification and flagging',
      'Recommended revisions and redlines',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Full contract review (up to 20 pages)',
          'Written summary of key terms',
          'Risk assessment',
          'Suggested revisions document',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1767972463877-b64ba4283cd0?w=400&h=300&fit=crop',
    price: 300,
    duration: 60,
    servicePlace: 'vendor',
    tags: ['contract', 'review', 'legal-analysis'],
    rating: 4.9,
  },
  {
    vendorName: 'Harrison & Cole Law Firm',
    serviceName: 'Estate Planning Consultation',
    name: 'Estate Planning Consultation',
    subTitle: 'Wills, trusts & estate strategy',
    shortDescriptionType: 'list',
    shortDescription: [
      'Estate planning needs assessment',
      'Will vs. trust comparison',
      'Beneficiary and asset review',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          '75-minute consultation',
          'Estate inventory worksheet',
          'Planning strategy recommendation',
          'Next steps for document preparation',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1652878530627-cc6f063e3947?w=400&h=300&fit=crop',
    price: 275,
    duration: 75,
    servicePlace: 'vendor',
    tags: ['estate-planning', 'will', 'trust'],
    rating: 4.7,
  },
  {
    vendorName: 'Liberty Immigration Law',
    serviceName: 'Visa Application Consultation',
    name: 'Visa Application Consultation',
    subTitle: 'Work, student & family visas',
    shortDescriptionType: 'list',
    shortDescription: [
      'Visa eligibility assessment',
      'Application document checklist',
      'Timeline and process overview',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          '1-hour consultation (English or Spanish)',
          'Visa category recommendation',
          'Document checklist',
          'Fee schedule overview',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1721138942121-a26751b520b5?w=400&h=300&fit=crop',
    price: 200,
    duration: 60,
    servicePlace: 'vendor',
    tags: ['visa', 'immigration', 'work-visa', 'student-visa'],
    rating: 4.9,
  },
  {
    vendorName: 'Liberty Immigration Law',
    serviceName: 'Green Card Consultation',
    name: 'Green Card Consultation',
    subTitle: 'Permanent residency guidance',
    shortDescriptionType: 'list',
    shortDescription: [
      'Green card eligibility evaluation',
      'Family vs. employment-based pathway comparison',
      'Priority date and timeline estimate',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Eligibility assessment',
          'Pathway recommendation',
          'Document requirements list',
          'Timeline projection',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1655722724135-eb9216c95618?w=400&h=300&fit=crop',
    price: 250,
    duration: 60,
    servicePlace: 'vendor',
    tags: ['green-card', 'permanent-residency', 'immigration'],
    rating: 4.9,
  },
  {
    vendorName: 'Liberty Immigration Law',
    serviceName: 'Citizenship & Naturalization',
    name: 'Citizenship & Naturalization',
    subTitle: 'US citizenship application guidance',
    shortDescriptionType: 'list',
    shortDescription: [
      'N-400 application review and preparation',
      'Civics test preparation resources',
      'Interview coaching and preparation',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Eligibility verification',
          'N-400 form review',
          'Document preparation checklist',
          'Mock interview session',
        ],
      },
    ],
    image:
      'https://plus.unsplash.com/premium_photo-1663089819902-b4a7321f38e0?w=400&h=300&fit=crop',
    price: 225,
    duration: 60,
    servicePlace: 'vendor',
    tags: ['citizenship', 'naturalization', 'n-400'],
    rating: 4.8,
  },
  {
    vendorName: 'Pacific Legal Advisors',
    serviceName: 'Business Formation Consultation',
    name: 'Startup Business Formation',
    subTitle: 'Tech startup entity setup',
    shortDescriptionType: 'list',
    shortDescription: [
      'Delaware vs. California incorporation advice',
      'Equity structure and vesting guidance',
      'Startup-focused entity formation',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Entity type consultation',
          'State selection guidance',
          'Equity planning overview',
          'Follow-up action items',
        ],
      },
    ],
    image:
      'https://plus.unsplash.com/premium_photo-1661769599827-d3cb736e1da8?w=400&h=300&fit=crop',
    price: 275,
    duration: 60,
    servicePlace: 'vendor',
    tags: ['startup', 'business-formation', 'incorporation', 'equity'],
    rating: 4.6,
  },
  {
    vendorName: 'Pacific Legal Advisors',
    serviceName: 'Contract Review',
    name: 'Contract Review & Drafting',
    subTitle: 'Contract drafting and negotiation',
    shortDescriptionType: 'list',
    shortDescription: [
      'Full contract review or new draft',
      'Negotiation-ready markup',
      'Tech-industry focused terms',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Contract review or drafting (up to 25 pages)',
          'Redlined version with comments',
          'Key terms summary',
          '15-minute follow-up call',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1626538366749-021838b63901?w=400&h=300&fit=crop',
    price: 325,
    duration: 75,
    servicePlace: 'vendor',
    tags: ['contract', 'drafting', 'negotiation', 'tech'],
    rating: 4.7,
  },

  // ── Tailoring ──────────────────────────
  {
    vendorName: 'Master Stitch Tailors',
    serviceName: 'Hem Adjustment',
    name: 'Hem Adjustment',
    subTitle: 'Pants, skirts & dresses',
    shortDescriptionType: 'list',
    shortDescription: [
      'Precise hem measurement and alteration',
      'Original hem preservation when possible',
      'Same-day service available',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Measurement and marking',
          'Professional hemming',
          'Pressing and finishing',
          'Quality inspection',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1625479144604-ae69462778b7?w=400&h=300&fit=crop',
    price: 25,
    duration: 30,
    servicePlace: 'vendor',
    tags: ['hem', 'alteration', 'pants', 'dress'],
    rating: 4.8,
  },
  {
    vendorName: 'Master Stitch Tailors',
    serviceName: 'Suit Fitting & Alteration',
    name: 'Suit Fitting & Alteration',
    subTitle: 'Expert suit adjustments',
    shortDescriptionType: 'list',
    shortDescription: [
      'Full suit measurement and fitting',
      'Jacket, pants and vest alterations',
      'Multiple adjustment areas included',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Initial fitting consultation',
          'Up to 4 alterations (sleeves, waist, hem, chest)',
          'Progress fitting',
          'Final pressing',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1591944489410-16ec1074a18e?w=400&h=300&fit=crop',
    price: 120,
    duration: 60,
    servicePlace: 'vendor',
    tags: ['suit', 'fitting', 'alteration', 'formal'],
    rating: 4.9,
  },
  {
    vendorName: 'Master Stitch Tailors',
    serviceName: 'Dress Alteration',
    name: 'Dress Alteration',
    subTitle: 'Resizing & restructuring',
    shortDescriptionType: 'list',
    shortDescription: [
      'Dress resizing up or down',
      'Strap, neckline and hem adjustments',
      'Delicate fabric expertise',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Fitting and measurement',
          'Up to 3 adjustments',
          'Pressing and steaming',
          'Quality check',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1633655442356-ab2dbc69c772?w=400&h=300&fit=crop',
    price: 85,
    duration: 45,
    servicePlace: 'vendor',
    tags: ['dress', 'alteration', 'resizing'],
    rating: 4.7,
  },
  {
    vendorName: 'Thread & Needle Bespoke',
    serviceName: 'Custom Suit',
    name: 'Custom Suit',
    subTitle: 'Bespoke suit tailored to you',
    shortDescriptionType: 'list',
    shortDescription: [
      'Full body measurement (30+ points)',
      'Fabric selection from premium mills',
      'Two fitting sessions included',
      'Handcrafted construction',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Initial consultation and measurement',
          'Fabric and lining selection',
          'First fitting and adjustments',
          'Final fitting and delivery',
        ],
      },
      {
        title: 'Timeline',
        type: 'paragraph',
        content: [
          'Custom suits typically take 4-6 weeks from initial measurement to final delivery.',
        ],
      },
    ],
    image:
      'https://plus.unsplash.com/premium_photo-1683140721927-aaed410fae29?w=400&h=300&fit=crop',
    price: 899,
    duration: 90,
    servicePlace: 'vendor',
    tags: ['custom-suit', 'bespoke', 'tailoring', 'premium'],
    rating: 4.8,
  },
  {
    vendorName: 'Thread & Needle Bespoke',
    serviceName: 'Custom Dress Shirt',
    name: 'Custom Dress Shirt',
    subTitle: 'Made-to-measure shirt',
    shortDescriptionType: 'list',
    shortDescription: [
      'Precise body measurements',
      'Choice of collar, cuff and pocket styles',
      'Premium cotton fabric options',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Body measurement',
          'Fabric and style selection',
          'Custom pattern creation',
          'Final fitting and delivery',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1633655442427-91c6b69561b1?w=400&h=300&fit=crop',
    price: 189,
    duration: 45,
    servicePlace: 'vendor',
    tags: ['custom-shirt', 'dress-shirt', 'bespoke'],
    rating: 4.7,
  },

  // ── Towing ─────────────────────────────
  {
    vendorName: 'Rapid Response Towing',
    serviceName: 'Standard Vehicle Tow',
    name: 'Standard Vehicle Tow',
    subTitle: 'Local car & light truck towing',
    shortDescriptionType: 'list',
    shortDescription: [
      'Up to 15-mile tow included',
      '30-minute average response time',
      'Cars and light trucks up to 10,000 lbs',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Dispatch and hookup',
          'Tow up to 15 miles',
          'Vehicle drop-off at destination',
          'After-hours service available',
        ],
      },
    ],
    image:
      'https://plus.unsplash.com/premium_photo-1670650044316-6914bf157344?w=400&h=300&fit=crop',
    price: 95,
    duration: 60,
    servicePlace: 'customer',
    tags: ['towing', 'local', 'car-tow'],
    rating: 4.6,
  },
  {
    vendorName: 'Rapid Response Towing',
    serviceName: 'Flatbed Towing',
    name: 'Flatbed Towing',
    subTitle: 'Safe transport for all vehicles',
    shortDescriptionType: 'list',
    shortDescription: [
      'Flatbed transport for luxury, AWD or damaged vehicles',
      'Zero-contact loading via hydraulic ramp',
      'Up to 20-mile tow included',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Flatbed truck dispatch',
          'Hydraulic ramp loading',
          'Secure tie-down and transport',
          'Up to 20-mile tow',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1739341244196-b4bf3920857e?w=400&h=300&fit=crop',
    price: 150,
    duration: 90,
    servicePlace: 'customer',
    tags: ['flatbed', 'luxury-tow', 'awd-tow'],
    rating: 4.7,
  },
  {
    vendorName: 'Rapid Response Towing',
    serviceName: 'Motorcycle Towing',
    name: 'Motorcycle Towing',
    subTitle: 'Safe motorcycle transport',
    shortDescriptionType: 'list',
    shortDescription: [
      'Specialized motorcycle loading equipment',
      'Soft-strap tie-downs to prevent damage',
      'Up to 15-mile transport',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Motorcycle-specific loading',
          'Padded wheel chock',
          'Soft-strap securing',
          'Transport up to 15 miles',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1686966933735-305bd8fe0a77?w=400&h=300&fit=crop',
    price: 75,
    duration: 45,
    servicePlace: 'customer',
    tags: ['motorcycle', 'towing', 'transport'],
    rating: 4.5,
  },
  {
    vendorName: 'Metro Tow & Haul',
    serviceName: 'Junk Vehicle Removal',
    name: 'Junk Vehicle Removal',
    subTitle: 'Free junk car pickup',
    shortDescriptionType: 'list',
    shortDescription: [
      'Free removal of non-running vehicles',
      'No title needed in most cases',
      'Environmentally responsible recycling',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Free pickup and removal',
          'Paperwork assistance',
          'Eco-friendly recycling',
          'Same-week scheduling',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1763515188616-b72e33065350?w=400&h=300&fit=crop',
    price: 0,
    duration: 60,
    servicePlace: 'customer',
    tags: ['junk-removal', 'free', 'recycling'],
    rating: 4.4,
  },
  {
    vendorName: 'Metro Tow & Haul',
    serviceName: 'Equipment Hauling',
    name: 'Equipment Hauling',
    subTitle: 'Heavy equipment transport',
    shortDescriptionType: 'list',
    shortDescription: [
      'Construction and industrial equipment hauling',
      'Heavy-duty flatbed with ramp loading',
      'Up to 25,000 lbs capacity',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Equipment assessment and planning',
          'Heavy-duty flatbed dispatch',
          'Loading and securing',
          'Transport up to 30 miles',
        ],
      },
    ],
    image:
      'https://plus.unsplash.com/premium_photo-1670650045964-7990668626b3?w=400&h=300&fit=crop',
    price: 350,
    duration: 120,
    servicePlace: 'customer',
    tags: ['hauling', 'equipment', 'heavy-duty'],
    rating: 4.5,
  },
  {
    vendorName: 'Metro Tow & Haul',
    serviceName: 'Standard Vehicle Tow',
    name: 'Local Vehicle Tow',
    subTitle: 'Portland area towing service',
    shortDescriptionType: 'list',
    shortDescription: [
      'Local towing within Portland metro',
      'Quick response times',
      'Cars and light trucks',
    ],
    description: [
      {
        title: "What's Included",
        type: 'list',
        content: [
          'Dispatch and hookup',
          'Tow up to 10 miles',
          'Drop-off at your chosen location',
          'Weekday and Saturday availability',
        ],
      },
    ],
    image: 'https://images.unsplash.com/photo-1756888218811-76f80423861b?w=400&h=300&fit=crop',
    price: 85,
    duration: 60,
    servicePlace: 'customer',
    tags: ['towing', 'local', 'portland'],
    rating: 4.5,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('🌱 Starting seed script…\n');

  // ── Connect ──────────────────────────────
  if (!process.env.COSMOS_DB_CONNECTION_STRING) {
    throw new Error('COSMOS_DB_CONNECTION_STRING not set. Check your .env file.');
  }

  await mongoose.connect(process.env.COSMOS_DB_CONNECTION_STRING, {
    retryWrites: false,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 75000,
  } as any);
  console.log('✅ Connected to database\n');

  // ── 1. Categories (lookup existing) ──────
  console.log('── Categories ──');
  const categoryMap: Record<string, any> = {};
  for (const name of CATEGORIES) {
    const cat = await Category.findOne({ name });
    if (!cat) {
      console.log(`  ⚠ Category "${name}" not found — creating…`);
      const newCat = await Category.create({
        name,
        description: `${name} services`,
        isActive: true,
      });
      categoryMap[name] = newCat;
    } else {
      console.log(`  ✓ found — ${name}`);
      categoryMap[name] = cat;
    }
  }

  // ── 2. SubCategories ─────────────────────
  console.log('\n── Sub-Categories ──');
  const subCategoryMap: Record<string, any> = {};
  for (const [catName, subs] of Object.entries(SUB_CATEGORIES)) {
    for (const sub of subs) {
      const doc = await findOrCreate(
        SubCategory as any,
        { name: sub.name },
        {
          name: sub.name,
          description: sub.description,
          categoryId: categoryMap[catName]._id,
          isActive: true,
        },
      );
      subCategoryMap[sub.name] = doc;
      await delay(150);
    }
  }

  // ── 3. Services ──────────────────────────
  console.log('\n── Services ──');
  const serviceMap: Record<string, any> = {};
  for (const [catName, services] of Object.entries(SERVICES)) {
    for (const svc of services) {
      const doc = await findOrCreate(
        Service as any,
        { name: svc.name },
        {
          name: svc.name,
          description: svc.description,
          categoryId: categoryMap[catName]._id,
          subCategoryId: subCategoryMap[svc.subCategory]._id,
          isActive: true,
        },
      );
      serviceMap[svc.name] = doc;
      await delay(150);
    }
  }

  // ── 4. Vendors ───────────────────────────
  console.log('\n── Vendors ──');
  const vendorMap: Record<string, any> = {};
  for (const v of VENDORS) {
    const doc = await findOrCreate(
      Vendor as any,
      { vendorName: v.vendorName },
      {
        vendorName: v.vendorName,
        serviceProviderName: v.serviceProviderName,
        aboutDescription: v.aboutDescription,
        country: v.country,
        state: v.state,
        city: v.city,
        zip: v.zip,
        address1: v.address1,
        email: v.email,
        phone: v.phone,
        rating: v.rating,
        tags: v.tags,
        verificationStatus: 'verified',
        isActive: true,
      },
    );
    vendorMap[v.vendorName] = doc;
    await delay(150);
  }

  // ── 4b. Vendor Users ────────────────────
  console.log('\n── Vendor Users ──');
  for (const vu of VENDOR_USERS) {
    const vendor = vendorMap[vu.vendorName];
    if (!vendor) {
      console.log(`  ⚠ vendor not found: ${vu.vendorName}`);
      continue;
    }

    // Find existing by email or clerkId — skip if exists
    let userDoc =
      (await User.findOne({ email: vu.email })) || (await User.findOne({ clerkId: vu.clerkId }));
    if (userDoc) {
      console.log(`  ✓ exists — ${vu.firstName} ${vu.lastName} (${vu.email})`);
    } else {
      try {
        userDoc = await User.create({
          firstName: vu.firstName,
          lastName: vu.lastName,
          email: vu.email,
          clerkId: vu.clerkId,
          userName: vu.email, // avoid null userName collision
          authProvider: 'clerk',
          role: 'vendor',
          isActive: true,
          lastSyncedAt: new Date(),
        });
        console.log(`  + created — ${vu.firstName} ${vu.lastName} (${vu.email})`);
      } catch (err: any) {
        if (err.code === 11000) {
          console.log(`  ⚠ skipped (duplicate) — ${vu.firstName} ${vu.lastName} (${vu.email})`);
          userDoc = await User.findOne({ email: vu.email });
        } else {
          throw err;
        }
      }
    }

    // Link vendor to user if not already linked
    if (
      userDoc &&
      (!(vendor as any).userId || (vendor as any).userId?.toString() !== userDoc._id.toString())
    ) {
      await Vendor.updateOne({ _id: vendor._id }, { $set: { userId: userDoc._id } });
      console.log(`    🔗 linked → ${vu.vendorName}`);
    }
    await delay(150);
  }

  // ── 5. Vendor Services ───────────────────
  console.log('\n── Vendor Services ──');
  const vendorServiceDocs: any[] = [];
  for (const vs of VENDOR_SERVICES) {
    const vendor = vendorMap[vs.vendorName];
    const service = serviceMap[vs.serviceName];
    if (!vendor) {
      console.log(`  ⚠ vendor not found: ${vs.vendorName}`);
      continue;
    }
    if (!service) {
      console.log(`  ⚠ service not found: ${vs.serviceName}`);
      continue;
    }

    const categoryId = service.categoryId;
    const subCategoryId = service.subCategoryId;

    const doc = await findOrCreate(
      VendorService as any,
      { name: vs.name, vendorId: vendor._id },
      {
        categoryId,
        subCategoryId,
        serviceId: service._id,
        vendorId: vendor._id,
        name: vs.name,
        subTitle: vs.subTitle,
        shortDescriptionType: vs.shortDescriptionType,
        shortDescription: vs.shortDescription,
        description: vs.description,
        image: vs.image,
        price: vs.price,
        duration: vs.duration,
        servicePlace: vs.servicePlace,
        tags: vs.tags,
        rating: vs.rating,
        isActive: true,
      },
    );
    vendorServiceDocs.push({ doc, vs });
    await delay(200);
  }

  // ── 5b. Update existing vendor service images ──
  console.log('\n── Updating vendor service images ──');
  for (const { doc: vsDoc, vs } of vendorServiceDocs) {
    if ((vsDoc as any).image !== vs.image) {
      await VendorService.updateOne({ _id: vsDoc._id }, { $set: { image: vs.image } });
      console.log(`  ✏ updated image — ${vs.name}`);
      await delay(150);
    }
  }

  // ── 6. Delete ALL existing slots for seeded vendor services (fresh recreation) ──
  console.log('\n── Deleting all existing slots ──');
  for (const { doc: vsDoc, vs } of vendorServiceDocs) {
    const result = await VendorServiceSlot.deleteMany({ vendorServiceId: vsDoc._id });
    if (result.deletedCount > 0) {
      console.log(`  🗑 deleted ${result.deletedCount} slot(s) — ${vs.name}`);
      await delay(100);
    }
  }

  // ── 7. Vendor Service Slots (fresh creation) ──
  console.log('\n── Creating Vendor Service Slots ──');
  let slotCount = 0;
  for (const { doc: vsDoc, vs } of vendorServiceDocs) {
    // Determine timing scheme based on category
    const category = VENDORS.find((v) => v.vendorName === vs.vendorName)?.category || '';
    const isBarber = category === 'Barber';
    const isFieldService = ['Towing', 'Air Quality'].includes(category);
    const hasSaturday = isFieldService || isBarber;

    const weekday = isBarber ? BARBER_WEEKDAY : isFieldService ? WEEKDAY_LONG : WEEKDAY_DEFAULT;
    const saturday = hasSaturday ? (isBarber ? BARBER_SAT : SAT_DEFAULT) : undefined;
    const reoccurrence = isBarber ? 2 : 1;

    const slotGroups = generateSlots(vsDoc._id, 60, reoccurrence, weekday, saturday);

    for (const group of slotGroups) {
      await createSlotWithDates(group);
      slotCount++;
      await delay(200);
    }
    console.log(
      `  + slots created — ${vs.name} (${slotGroups.length} month-groups, ${slotGroups.reduce((s, g) => s + g.dates.length, 0)} dates)`,
    );
  }

  // ── Summary ──────────────────────────────
  console.log('\n═══════════════════════════════════');
  console.log('🎉 Seed complete!');
  console.log(`  Categories:       ${Object.keys(categoryMap).length}`);
  console.log(`  Sub-Categories:   ${Object.keys(subCategoryMap).length}`);
  console.log(`  Services:         ${Object.keys(serviceMap).length}`);
  console.log(`  Vendors:          ${Object.keys(vendorMap).length}`);
  console.log(`  Vendor Users:     ${VENDOR_USERS.length}`);
  console.log(`  Vendor Services:  ${vendorServiceDocs.length}`);
  console.log(`  Slot documents:   ${slotCount}`);
  console.log('═══════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('Disconnected from database.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
