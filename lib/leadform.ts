/**
 * Lead Form page type — content schema and defaults.
 * Page type: 'ldf'
 * URL prefix: /ldf/{public_id}
 */

/** A single configurable field on the lead form */
export type LeadFormField = {
  key: "name" | "email" | "phone" | "message" | "company" | "website";
  label: string;      // display label
  placeholder?: string;
  required: boolean;
  visible: boolean;
};

/** The JSONB shape stored in pages.content for page_type = 'ldf' */
export type LeadFormContent = {
  headline?: string;
  subheadline?: string;
  description?: string;
  button_label?: string;
  success_message?: string;
  image_url?: string;

  /** Ordered field configuration */
  fields?: LeadFormField[];

  /** Theme */
  theme?: "light" | "dark";
  accent_color?: string;   // hex e.g. "#7c3aed"

  /** SEO */
  seo_title?: string;
  seo_description?: string;
};

export const DEFAULT_FIELDS: LeadFormField[] = [
  { key: "name",    label: "Full name",    placeholder: "Your name",         required: true,  visible: true },
  { key: "email",   label: "Email",        placeholder: "your@email.com",    required: true,  visible: true },
  { key: "phone",   label: "Phone",        placeholder: "+91 98765 43210",   required: false, visible: true },
  { key: "company", label: "Company",      placeholder: "Your company",       required: false, visible: false },
  { key: "website", label: "Website",      placeholder: "https://…",          required: false, visible: false },
  { key: "message", label: "Your message", placeholder: "Tell us more…",      required: false, visible: true },
];

export const DEFAULT_LEADFORM: LeadFormContent = {
  headline: "Get in touch",
  subheadline: "We'd love to hear from you",
  description: "",
  button_label: "Send message",
  success_message: "Thank you! We'll be in touch soon.",
  image_url: "",
  fields: DEFAULT_FIELDS,
  theme: "light",
  accent_color: "#7c3aed",
  seo_title: "",
  seo_description: "",
};
