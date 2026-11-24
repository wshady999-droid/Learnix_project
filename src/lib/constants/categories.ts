export const COURSE_CATEGORIES = [
  "IT",
  "Mobile App",
  "Web",
  "Cybersecurity",
  "Cloud Computing",
  "Social Media",
  "Java",
  "Testing",
  "Data Analysis",
  "Data Modeling",
  "Database",
  "IOT",
  "Project Management",
  "BPM",
] as const;

export type CourseCategory = (typeof COURSE_CATEGORIES)[number];
