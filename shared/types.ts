export type ModerationStatus = "pending" | "approved" | "rejected";
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
}
export interface Category {
  id: number;
  source_id: string;
  name: string;
  slug: string;
  image_url: string;
  is_popular: boolean;
  is_promoted: boolean;
  popular_icon: string;
  popular_order: number;
  display_order: number;
  business_count?: number;
}
export interface Business {
  id: number;
  source_id: string;
  name: string;
  slug: string;
  category_id: number;
  category: Category;
  description: string;
  contact_person: string;
  phones: string;
  primary_phone: string;
  display_phone: string;
  city: string;
  address: string;
  address_street: string;
  address_unit: string;
  address_state: string;
  address_zip: string;
  license: string;
  email: string;
  website: string;
  image_url: string;
  display_image_url: string;
  premium_image_url: string;
  special_offers: string;
  is_premium: boolean;
  is_featured: boolean;
  premium_interest: boolean;
  status: ModerationStatus;
  created_at: string;
  updated_at: string;
  average_rating: number | null;
  review_count: number;
  verified: boolean;
  claim_status: string;
  is_favorite: boolean;
  can_edit: boolean;
  owner_id?: number | null;
  submitted_by?: number | null;
}
export interface Review {
  id: number;
  business_id: number;
  business?: Business;
  display_name: string;
  rating: number;
  body: string;
  status: ModerationStatus;
  created_at: string;
}
export interface Session {
  user: User | null;
  csrfToken: string;
  features: {
    google: boolean;
    smtp: boolean;
    ocr: boolean;
    website_extraction: boolean;
    preview: boolean;
  };
  favorites: number[];
}
export interface BusinessInput {
  name: string;
  category_id: number;
  contact_person?: string;
  phones?: string;
  city?: string;
  address_street?: string;
  address_unit?: string;
  address_state?: string;
  address_zip?: string;
  license?: string;
  email?: string;
  website?: string;
  description?: string;
  premium_interest?: boolean;
  image?: string;
  confirm_separate?: boolean;
}
export interface DirectoryResponse {
  businesses: Business[];
  categories: Category[];
  popular_categories: Category[];
  locations: string[];
  total_count: number;
  business_count: number;
  page: number;
  pages: number;
  page_size: number;
  category_groups: {
    name: string;
    category: Category;
    businesses: Business[];
    count: number;
  }[];
}
export interface ApiError {
  error: { code: string; message: string; fields?: Record<string, string> };
  duplicates?: Business[];
}
