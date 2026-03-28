import { pgTable, text, serial, integer, boolean, timestamp, json, date, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  isAdmin: true,
});

// Course schema
export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(), // In cents
  category: text("category").notNull(),
  imageUrl: text("image_url").notNull(),
  instructorName: text("instructor_name").notNull(),
  rating: integer("rating").default(0),
  modules: integer("modules").default(0).notNull(),
  published: boolean("published").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCourseSchema = createInsertSchema(courses).pick({
  title: true,
  description: true,
  price: true,
  category: true,
  imageUrl: true,
  instructorName: true,
  rating: true,
  published: true,
});

// Video metadata schema for multiple videos
export type VideoItem = {
  name: string;
  url: string;
  quality?: string; // Optional quality label like "720p", "1080p"
  width?: number;    // Optional video width in pixels
  height?: number;   // Optional video height in pixels
  bitrate?: number;  // Optional video bitrate in kbps
  isDefault?: boolean; // Whether this quality is the default
  fileKey?: string;   // S3 file key for presigned URL generation
  type?: 'uploaded' | 'youtube'; // Video source type
  youtubeId?: string; // YouTube video ID for embedded videos
};

export type PDFItem = {
  name: string;
  url: string;
};

// Content schema (items within courses)
export const contents = pgTable("contents", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull(), // Course the content belongs to
  title: text("title").notNull(),
  thumbnailUrl: text("thumbnail_url"), // Thumbnail image for the lesson
  // Each content can have multiple types of content
  textContent: text("text_content"), // HTML content for the lesson
  videoUrl: text("video_url"), // URL for single video content (legacy)
  videoItems: json("video_items").$type<VideoItem[]>(), // Multiple videos with names
  youtubeUrl: text("youtube_url"), // YouTube video URL for embedded content
  youtubeName: text("youtube_name"), // Display name for YouTube video
  pdfUrl: text("pdf_url"), // URL for PDF content (legacy)
  pdfItems: json("pdf_items").$type<PDFItem[]>(), // Multiple PDFs with names
  quizContent: text("quiz_content"), // JSON content for quiz
  // Legacy field for backward compatibility
  type: text("type").notNull(), // "mixed" or individual types: video, pdf, text, quiz
  content: text("content").notNull(), // Legacy field for compatibility
  order: integer("order").notNull(),
  // Field to store custom element order for displaying content
  display_order: text("display_order"), // JSON stringified array of element IDs in order
});

export const insertContentSchema = createInsertSchema(contents).pick({
  courseId: true,
  title: true,
  thumbnailUrl: true,
  textContent: true,
  videoUrl: true,
  videoItems: true,
  youtubeUrl: true,
  youtubeName: true,
  pdfUrl: true,
  pdfItems: true,
  quizContent: true,
  type: true,
  content: true,
  order: true,
  display_order: true,
});

// Payment plans schema
export const paymentPlans = pgTable("payment_plans", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull(),
  name: text("name").notNull(), // E.g., "3 Months", "6 Months"
  installments: integer("installments").notNull(), // Number of payments
  installmentAmount: integer("installment_amount").notNull(), // In cents
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPaymentPlanSchema = createInsertSchema(paymentPlans).pick({
  courseId: true,
  name: true,
  installments: true,
  installmentAmount: true,
  active: true,
});

// Enrollment schema (users enrolled in courses)
export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  courseId: integer("course_id").notNull(),
  completed: boolean("completed").default(false).notNull(),
  progress: integer("progress").default(0).notNull(), // percentage
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  // Course access duration fields
  accessDuration: integer("access_duration"), // Duration in months (2, 4, 6, or 12)
  expiresAt: timestamp("expires_at"), // When the enrollment expires
  // Payment related fields
  paymentType: text("payment_type").default("full").notNull(), // "full" or "installment"
  paymentPlanId: integer("payment_plan_id"), // Required if paymentType is "installment"
  installmentsPaid: integer("installments_paid").default(0),
  totalInstallments: integer("total_installments").default(1),
  paymentStatus: text("payment_status").default("completed").notNull(), // "pending", "active", "completed", "failed"
  stripeSubscriptionId: text("stripe_subscription_id"), // For tracking subscriptions
  stripeCustomerId: text("stripe_customer_id"), // For tracking customers
});

export const insertEnrollmentSchema = createInsertSchema(enrollments).pick({
  userId: true,
  courseId: true,
  completed: true,
  progress: true,
  accessDuration: true,
  expiresAt: true,
  paymentType: true,
  paymentPlanId: true,
  installmentsPaid: true,
  totalInstallments: true,
  paymentStatus: true,
  stripeSubscriptionId: true,
  stripeCustomerId: true,
});

// Progress tracking schema (user's progress in content)
export const progress = pgTable("progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  contentId: integer("content_id").notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  mood: text("mood"), // 😊 happy, 😐 neutral, 😟 confused, 😄 excited, 🤔 thinking
  moodNote: text("mood_note"), // Additional note about the mood
});

export const insertProgressSchema = createInsertSchema(progress).pick({
  userId: true,
  contentId: true,
  completed: true,
  mood: true,
  moodNote: true,
});

// Category schema
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  icon: text("icon").notNull(), // CSS class or icon name
  imageUrl: text("image_url"), // Image URL for category
  courseCount: integer("course_count").default(0).notNull(),
});

export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  icon: true,
  imageUrl: true,
  courseCount: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;

export type Content = typeof contents.$inferSelect;
export type InsertContent = z.infer<typeof insertContentSchema>;

export type PaymentPlan = typeof paymentPlans.$inferSelect;
export type InsertPaymentPlan = z.infer<typeof insertPaymentPlanSchema>;

export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;

export type Progress = typeof progress.$inferSelect;
export type InsertProgress = z.infer<typeof insertProgressSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

// Comments schema for content discussions
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // User who made the comment
  contentId: integer("content_id").notNull(), // Content being commented on
  text: text("text").notNull(), // Comment text
  createdAt: timestamp("created_at").defaultNow().notNull(),
  parentId: integer("parent_id"), // For replies to other comments
});

// Create a full schema first
const fullCommentSchema = createInsertSchema(comments);

// Then create a public version that doesn't require userId (added by the server)
export const insertCommentSchema = fullCommentSchema.pick({
  contentId: true,
  text: true,
  parentId: true,
});

export type Comment = typeof comments.$inferSelect;
// Use the full schema for internal operations
export type InsertCommentInternal = z.infer<typeof fullCommentSchema>;
// Use the public schema for client-side operations
export type InsertComment = z.infer<typeof insertCommentSchema>;

// Streaming manifests schema for adaptive bitrate video playback
export const streamingManifests = pgTable("streaming_manifests", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull(),  // Related content item
  videoFileKey: text("video_file_key").notNull(), // Original video file key or URL
  path: text("path").notNull(), // Local file path to the manifest
  url: text("url").notNull(), // Public URL to access the manifest
  s3Key: text("s3_key"), // S3 key for CDN/S3 storage
  format: text("format").notNull(), // "hls" or "dash"
  created: timestamp("created").defaultNow().notNull(), // When the manifest was created
  lastAccessed: timestamp("last_accessed"), // When the manifest was last accessed
});

export const insertStreamingManifestSchema = createInsertSchema(streamingManifests).pick({
  contentId: true,
  videoFileKey: true,
  path: true,
  url: true,
  s3Key: true,
  format: true,
});

export type StreamingManifest = typeof streamingManifests.$inferSelect;
export type InsertStreamingManifest = z.infer<typeof insertStreamingManifestSchema>;

// ===== WEBINAR SYSTEM SCHEMAS =====

// Presentation resources for webinars (PDFs, slides, etc.)
export type WebinarResourceItem = {
  name: string;
  url: string;
  fileKey?: string;
  type: string; // "pdf", "image", "presentation"
  order: number;
  createdAt: string;
};

// Offer type for webinar special offers
export type WebinarOfferItem = {
  id: string;
  title: string;
  description: string;
  price?: number;
  buttonText: string;
  buttonUrl: string;
  imageUrl?: string;
  timing?: number; // When to show the offer (minutes into webinar)
  durationSeconds?: number; // How long to display the offer
  active: boolean;
  created: string;
};

// Webinar camera/stream layout options
export type WebinarLayoutSetting = {
  type: string; // "picture-in-picture", "side-by-side", "fullscreen", "presentation-focus", "speaker-focus"
  cameraSize: string; // "small", "medium", "large" 
  cameraPosition: string; // "top-left", "top-right", "bottom-left", "bottom-right", "center"
  hideAttendees: boolean;
};

// Webinar schema
export const webinars = pgTable("webinars", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  instructorName: text("instructor_name").notNull(),
  scheduledStartTime: timestamp("scheduled_start_time").notNull(),
  scheduledEndTime: timestamp("scheduled_end_time").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  status: text("status").default("draft").notNull(), // "draft", "scheduled", "live", "ended", "cancelled"
  hostUrl: text("host_url"),
  joinUrl: text("join_url"),
  recordingUrl: text("recording_url"),
  maxParticipants: integer("max_participants"),
  settings: json("settings"), // stores all settings like allowChat, allowQuestions etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: integer("created_by").notNull(), // User ID of the host/admin
});

export const insertWebinarSchema = createInsertSchema(webinars).pick({
  title: true,
  description: true,
  instructorName: true,
  status: true,
  scheduledStartTime: true,
  scheduledEndTime: true,
  thumbnailUrl: true,
  maxParticipants: true,
  settings: true,
  createdBy: true
});

// Webinar attendees
export const webinarAttendees = pgTable("webinar_participants", {
  id: serial("id").primaryKey(),
  webinarId: integer("webinar_id").notNull(),
  attendeeId: uuid("attendee_id").defaultRandom().notNull(), // Unique identifier for the attendee
  name: text("name").notNull(), // Can be just a name for non-registered users
  email: text("email"), // Optional for simple access
  userId: integer("user_id"), // Linked to user account if registered
  joinTime: timestamp("join_time").defaultNow().notNull(),
  leaveTime: timestamp("leave_time"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceType: text("device_type"), // "desktop", "mobile", "tablet"
  inRoom: boolean("in_room").default(true).notNull(),
  role: text("role").default("attendee").notNull(), // "attendee", "moderator", "host"
  showOnScreen: boolean("show_on_screen").default(false).notNull(), // For "bringing on stage"
  timeWatched: integer("time_watched").default(0), // In seconds
});

export const insertWebinarAttendeeSchema = createInsertSchema(webinarAttendees).pick({
  webinarId: true,
  name: true,
  email: true,
  userId: true,
  ipAddress: true,
  userAgent: true,
  deviceType: true,
  role: true,
});

// Webinar chat messages
export const webinarChatMessages = pgTable("webinar_chat_messages", {
  id: serial("id").primaryKey(),
  webinarId: integer("webinar_id").notNull(),
  attendeeId: uuid("attendee_id").notNull(),
  userId: integer("user_id"), // Optional, linked to user account if registered
  name: text("name").notNull(), // Display name
  message: text("message").notNull(),
  isPrivate: boolean("is_private").default(false).notNull(), // Private to admin/host
  isQuestion: boolean("is_question").default(false).notNull(), // Is this a question?
  isAnswered: boolean("is_answered").default(false), // Has this question been answered?
  isHighlighted: boolean("is_highlighted").default(false), // Admin highlighted the message
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWebinarChatMessageSchema = createInsertSchema(webinarChatMessages).pick({
  webinarId: true,
  attendeeId: true,
  userId: true,
  name: true,
  message: true,
  isPrivate: true,
  isQuestion: true,
});

// Types for the webinar system
export type Webinar = typeof webinars.$inferSelect;
export type InsertWebinar = z.infer<typeof insertWebinarSchema>;

export type WebinarAttendee = typeof webinarAttendees.$inferSelect;
export type InsertWebinarAttendee = z.infer<typeof insertWebinarAttendeeSchema>;

export type WebinarChatMessage = typeof webinarChatMessages.$inferSelect;
export type InsertWebinarChatMessage = z.infer<typeof insertWebinarChatMessageSchema>;

// VS Dating Reviews schema - for random review generator
export const vsReviews = pgTable("vs_reviews", {
  id: serial("id").primaryKey(),
  reviewText: text("review_text").notNull(),
  isShown: boolean("is_shown").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVsReviewSchema = createInsertSchema(vsReviews).pick({
  reviewText: true,
  isShown: true,
});

export type VsReview = typeof vsReviews.$inferSelect;
export type InsertVsReview = z.infer<typeof insertVsReviewSchema>;
