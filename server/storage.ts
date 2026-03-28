import { 
  User, InsertUser, 
  Course, InsertCourse, 
  Content, InsertContent,
  PaymentPlan, InsertPaymentPlan,
  Enrollment, InsertEnrollment,
  Progress, InsertProgress,
  Category, InsertCategory,
  Comment, InsertComment,
  StreamingManifest, InsertStreamingManifest,
  VsReview,
  VideoItem, PDFItem,
  users, courses, contents, paymentPlans, enrollments, progress, categories, comments, streamingManifests, vsReviews
} from "@shared/schema";
import session from "express-session";
import { db } from "./db-emergency";
import { eq, and, desc, sql, count, sum, isNull } from "drizzle-orm";
import { Store } from "express-session";
import connectPgSimple from "connect-pg-simple";
import memorystore from "memorystore";

// Helper function to safely parse JSON arrays with error handling
// Generic version with proper typing for each specific array type
function safeParseJsonArray<T>(jsonString: string | null | any, itemName: string, itemId: number | string): T[] {
  console.log(`Parsing ${itemName} for item ${itemId}, type: ${typeof jsonString}`);
  
  // If null, undefined, or empty, return empty array
  if (jsonString === null || jsonString === undefined || jsonString === '') {
    console.log(`${itemName} is null, undefined, or empty`);
    return [] as T[];
  }
  
  // If it's already an array, return it directly with proper type casting
  if (Array.isArray(jsonString)) {
    console.log(`${itemName} is already an array with ${jsonString.length} items`);
    return [...jsonString] as T[]; // Return a copy to ensure it's a clean array
  }
  
  // Convert to string if it's not already a string
  // This handles cases where we might get Buffer or other objects
  let jsonAsString: string;
  if (typeof jsonString === 'string') {
    jsonAsString = jsonString;
  } else {
    try {
      jsonAsString = String(jsonString);
      console.log(`Converted ${itemName} to string: ${jsonAsString.substring(0, 50)}...`);
    } catch (e) {
      console.error(`Failed to convert ${itemName} to string:`, e);
      return [] as T[];
    }
  }
  
  // Handle common empty/invalid values
  if (
    jsonAsString === '""' || 
    jsonAsString === '"undefined"' || 
    jsonAsString === '"null"' || 
    jsonAsString.trim() === '' ||
    jsonAsString === '"' || 
    jsonAsString === '[]"' || 
    jsonAsString === '[' || 
    jsonAsString === ']' ||
    jsonAsString === '{}' 
  ) {
    console.log(`${itemName} contains invalid JSON value: "${jsonAsString}"`);
    return [] as T[];
  }
  
  try {
    // Attempt to parse the JSON
    const parsed = JSON.parse(jsonAsString);
    
    // Ensure the result is an array
    if (Array.isArray(parsed)) {
      // Make sure each item in the array is valid by creating a new array
      const validArray = parsed.filter(item => item !== null && item !== undefined);
      console.log(`Successfully parsed ${itemName} into array with ${validArray.length} items`);
      return validArray as T[];
    } else {
      console.warn(`Warning: ${itemName} is not an array after parsing for item ${itemId}`, parsed);
      // If we got an object with name/url structure, try to convert it to an array
      if (parsed && typeof parsed === 'object' && 'name' in parsed && 'url' in parsed) {
        console.log(`Converting single object to array for ${itemName}`);
        return [parsed] as T[];
      }
      return [] as T[];
    }
  } catch (e) {
    console.error(`Error parsing ${itemName} for item ${itemId}:`, e);
    console.error(`Problem JSON string: "${jsonAsString.substring(0, 100)}..."`);
    return [] as T[];
  }
}

// Create the session stores
const pgSession = connectPgSimple(session);
const MemoryStore = memorystore(session);

// Mock category data
const defaultCategories = [
  { name: "Web Development", icon: "laptop-code", courseCount: 48 },
  { name: "Mobile Development", icon: "mobile-alt", courseCount: 32 },
  { name: "Data Science", icon: "chart-line", courseCount: 24 },
  { name: "Design", icon: "photo-video", courseCount: 36 },
  { name: "Marketing", icon: "bullhorn", courseCount: 21 },
  { name: "Business", icon: "briefcase", courseCount: 42 },
  { name: "Languages", icon: "language", courseCount: 28 }
];

// Mock course data
const defaultCourses = [
  {
    title: "Modern Web Development",
    description: "Learn the fundamentals of modern web development including HTML, CSS, and JavaScript.",
    price: 8999, // $89.99 in cents
    category: "Web Development",
    imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085",
    instructorName: "John Smith",
    rating: 48, // 4.8
    published: true,
    modules: 18
  },
  {
    title: "Mobile App Development",
    description: "Build native mobile applications for iOS and Android using React Native.",
    price: 9999, // $99.99 in cents
    category: "Mobile Development",
    imageUrl: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb",
    instructorName: "Sarah Johnson",
    rating: 47, // 4.7
    published: true,
    modules: 12
  },
  {
    title: "Intro to Data Science",
    description: "Master the fundamentals of data analysis, visualization, and machine learning.",
    price: 12999, // $129.99 in cents
    category: "Data Science",
    imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d",
    instructorName: "Michael Chen",
    rating: 49, // 4.9
    published: true,
    modules: 15
  },
  {
    title: "UI/UX Design Fundamentals",
    description: "Learn the principles of user interface and user experience design.",
    price: 7999, // $79.99 in cents
    category: "Design",
    imageUrl: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5",
    instructorName: "Emily Rodriguez",
    rating: 46, // 4.6
    published: false,
    modules: 10
  }
];

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;

  // Course operations
  getCourse(id: number): Promise<Course | undefined>;
  getAllCourses(): Promise<Course[]>;
  getCoursesByCategory(category: string): Promise<Course[]>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: number, course: Partial<InsertCourse>): Promise<Course | undefined>;
  deleteCourse(id: number): Promise<boolean>;

  // Payment plan operations
  getPaymentPlan(id: number): Promise<PaymentPlan | undefined>;
  getPaymentPlansByCourse(courseId: number): Promise<PaymentPlan[]>;
  createPaymentPlan(plan: InsertPaymentPlan): Promise<PaymentPlan>;
  updatePaymentPlan(id: number, plan: Partial<InsertPaymentPlan>): Promise<PaymentPlan | undefined>;
  deletePaymentPlan(id: number): Promise<boolean>;

  // Content operations
  getContent(id: number): Promise<Content | undefined>;
  getContentsByCourse(courseId: number): Promise<Content[]>;
  getAllContents(): Promise<Content[]>;
  createContent(content: InsertContent): Promise<Content>;
  updateContent(id: number, content: Partial<InsertContent>): Promise<Content | undefined>;
  deleteContent(id: number): Promise<boolean>;

  // Enrollment operations
  getEnrollment(id: number): Promise<Enrollment | undefined>;
  getEnrollmentsByUser(userId: number): Promise<Enrollment[]>;
  getEnrollmentsByCourse(courseId: number): Promise<Enrollment[]>;
  createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment>;
  updateEnrollment(id: number, enrollment: Partial<InsertEnrollment>): Promise<Enrollment | undefined>;
  deleteEnrollment(id: number): Promise<boolean>;
  getEnrollments(): Map<number, Enrollment>; // Helper for webhook processing

  // Progress operations
  getProgress(id: number): Promise<Progress | undefined>;
  getProgressByUser(userId: number): Promise<Progress[]>;
  getProgressByContent(contentId: number): Promise<Progress[]>;
  getProgressByUserAndContent(userId: number, contentId: number): Promise<Progress | undefined>;
  createOrUpdateProgress(progress: InsertProgress): Promise<Progress>;
  deleteProgress(id: number): Promise<boolean>;

  // Category operations
  getCategory(id: number): Promise<Category | undefined>;
  getCategoryByName(name: string): Promise<Category | undefined>;
  getAllCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;

  // Comment operations
  getComment(id: number): Promise<Comment | undefined>;
  getCommentsByContent(contentId: number): Promise<Comment[]>;
  getCommentsByUser(userId: number): Promise<Comment[]>;
  createComment(comment: InsertComment & { userId: number }): Promise<Comment>;
  deleteComment(id: number): Promise<boolean>;
  
  // Admin statistics
  getAdminStats(): Promise<any>;
  
  // Migration support
  runMigrations(migrationType: any): Promise<void>;
  
  // Streaming manifest operations for adaptive bitrate streaming
  getStreamingManifest(contentId: number, videoFileKey: string): Promise<StreamingManifest | undefined>;
  saveStreamingManifest(manifest: InsertStreamingManifest): Promise<StreamingManifest>;
  updateStreamingManifestAccess(id: number): Promise<boolean>;
  getMediaUrl(fileKey: string): Promise<string>;
  
  // VS Dating review operations
  getRandomUnshownReview(): Promise<VsReview | undefined>;
  resetAllReviews(): Promise<void>;

  // Session store
  sessionStore: Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private courses: Map<number, Course>;
  private contents: Map<number, Content>;
  private paymentPlans: Map<number, PaymentPlan>;
  private enrollments: Map<number, Enrollment>;
  private progresses: Map<number, Progress>;
  private categories: Map<number, Category>;
  private comments: Map<number, Comment>;
  private streamingManifests: Map<number, StreamingManifest>;
  
  // Auto-increment IDs
  private userId: number;
  private courseId: number;
  private contentId: number;
  private paymentPlanId: number;
  private enrollmentId: number;
  private progressId: number;
  private categoryId: number;
  private commentId: number;
  private manifestId: number;
  
  // Session store
  sessionStore: Store;

  constructor() {
    this.users = new Map();
    this.courses = new Map();
    this.contents = new Map();
    this.paymentPlans = new Map();
    this.enrollments = new Map();
    this.progresses = new Map();
    this.categories = new Map();
    this.comments = new Map();
    this.streamingManifests = new Map();
    
    this.userId = 1;
    this.courseId = 1;
    this.contentId = 1;
    this.paymentPlanId = 1;
    this.enrollmentId = 1;
    this.progressId = 1;
    this.categoryId = 1;
    this.commentId = 1;
    this.manifestId = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });

    // Initialize with the admin user - we'll handle admin creation in a separate async function
    this.initializeAdminUser();

    // Initialize categories
    this.initializeCategories();
    
    // Initialize sample courses
    this.initializeCourses();
  }

  // Initialize admin user
  private async initializeAdminUser(): Promise<void> {
    try {
      const adminEmail = "Darchiav@gmail.com";
      const adminPassword = "Jimbo2345";
      
      // Check if admin user already exists
      const existingAdmin = await this.getUserByEmail(adminEmail);
      if (!existingAdmin) {
        console.log("Creating admin user:", adminEmail);
        
        // Import the passwordUtils object to avoid circular dependencies
        const { passwordUtils } = await import('./auth');
        
        // Hash the password properly
        const hashedPassword = await passwordUtils.hashPassword(adminPassword);
        
        await this.createUser({
          username: "Administrator",
          email: adminEmail,
          password: hashedPassword,
          isAdmin: true
        });

        console.log("Admin user created successfully with hashed password");
      } else {
        // Check if existing admin has unhashed password and fix it
        if (existingAdmin.password && !existingAdmin.password.includes('.')) {
          console.log("Fixing admin user with unhashed password");
          const { passwordUtils } = await import('./auth');
          const hashedPassword = await passwordUtils.hashPassword(existingAdmin.password);
          
          await this.updateUser(existingAdmin.id, {
            password: hashedPassword
          });
          
          console.log("Admin password has been properly hashed");
        }
      }
    } catch (error) {
      console.error("Error initializing admin user:", error);
    }
  }
  
  // Initialize categories
  private async initializeCategories(): Promise<void> {
    for (const category of defaultCategories) {
      await this.createCategory(category);
    }
  }

  // Initialize courses
  private async initializeCourses(): Promise<void> {
    for (const course of defaultCourses) {
      await this.createCourse(course);
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const createdAt = new Date();
    
    // Ensure required fields have proper defaults to satisfy typescript
    const user: User = { 
      id, 
      username: insertUser.username,
      email: insertUser.email,
      password: insertUser.password ?? null,
      isAdmin: insertUser.isAdmin ?? false,
      createdAt 
    };
    
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) return undefined;
    
    const updatedUser = { ...existingUser, ...user };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  // Helper method to get all enrollments (needed for webhook processing)
  getEnrollments(): Map<number, Enrollment> {
    return this.enrollments;
  }

  // Course operations
  async getCourse(id: number): Promise<Course | undefined> {
    return this.courses.get(id);
  }

  async getAllCourses(): Promise<Course[]> {
    return Array.from(this.courses.values());
  }

  async getCoursesByCategory(category: string): Promise<Course[]> {
    return Array.from(this.courses.values()).filter(
      (course) => course.category.toLowerCase() === category.toLowerCase()
    );
  }

  async createCourse(insertCourse: InsertCourse): Promise<Course> {
    const id = this.courseId++;
    const createdAt = new Date();
    const updatedAt = new Date();
    
    // Create course with proper default values for optional fields
    const course: Course = { 
      id,
      title: insertCourse.title,
      description: insertCourse.description,
      price: insertCourse.price,
      category: insertCourse.category,
      imageUrl: insertCourse.imageUrl,
      instructorName: insertCourse.instructorName,
      rating: insertCourse.rating ?? null,
      modules: 0, // Default value for modules field
      published: insertCourse.published ?? true,
      createdAt,
      updatedAt
    };
    
    this.courses.set(id, course);
    
    // Update category course count
    const category = await this.getCategoryByName(course.category);
    if (category) {
      await this.updateCategory(category.id, { 
        courseCount: category.courseCount + 1 
      });
    }
    
    return course;
  }

  async updateCourse(id: number, course: Partial<InsertCourse>): Promise<Course | undefined> {
    const existingCourse = this.courses.get(id);
    if (!existingCourse) return undefined;
    
    // If category changed, update counts
    if (course.category && course.category !== existingCourse.category) {
      const oldCategory = await this.getCategoryByName(existingCourse.category);
      const newCategory = await this.getCategoryByName(course.category);
      
      if (oldCategory) {
        await this.updateCategory(oldCategory.id, { 
          courseCount: Math.max(0, oldCategory.courseCount - 1) 
        });
      }
      
      if (newCategory) {
        await this.updateCategory(newCategory.id, { 
          courseCount: newCategory.courseCount + 1 
        });
      }
    }
    
    const updatedCourse = { 
      ...existingCourse, 
      ...course, 
      updatedAt: new Date() 
    };
    this.courses.set(id, updatedCourse);
    return updatedCourse;
  }

  async deleteCourse(id: number): Promise<boolean> {
    const course = this.courses.get(id);
    if (!course) return false;
    
    // Update category course count
    const category = await this.getCategoryByName(course.category);
    if (category) {
      await this.updateCategory(category.id, { 
        courseCount: Math.max(0, category.courseCount - 1) 
      });
    }
    
    return this.courses.delete(id);
  }
  
  // Payment plan operations
  async getPaymentPlan(id: number): Promise<PaymentPlan | undefined> {
    return this.paymentPlans.get(id);
  }
  
  async getPaymentPlansByCourse(courseId: number): Promise<PaymentPlan[]> {
    return Array.from(this.paymentPlans.values())
      .filter(plan => plan.courseId === courseId && plan.active);
  }
  
  async createPaymentPlan(plan: InsertPaymentPlan): Promise<PaymentPlan> {
    const id = this.paymentPlanId++;
    const createdAt = new Date();
    
    // Create payment plan with proper default values
    const paymentPlan: PaymentPlan = { 
      id, 
      name: plan.name,
      courseId: plan.courseId,
      installments: plan.installments,
      installmentAmount: plan.installmentAmount,
      active: plan.active ?? true,  // Default to active
      createdAt 
    };
    
    this.paymentPlans.set(id, paymentPlan);
    return paymentPlan;
  }
  
  async updatePaymentPlan(id: number, plan: Partial<InsertPaymentPlan>): Promise<PaymentPlan | undefined> {
    const existingPlan = this.paymentPlans.get(id);
    if (!existingPlan) return undefined;
    
    const updatedPlan = { ...existingPlan, ...plan };
    this.paymentPlans.set(id, updatedPlan);
    return updatedPlan;
  }
  
  async deletePaymentPlan(id: number): Promise<boolean> {
    return this.paymentPlans.delete(id);
  }

  // Content operations
  async getContent(id: number): Promise<Content | undefined> {
    return this.contents.get(id);
  }
  
  async getContentsByCourse(courseId: number): Promise<Content[]> {
    return Array.from(this.contents.values())
      .filter((content) => content.courseId === courseId)
      .sort((a, b) => a.order - b.order);
  }
  
  async getAllContents(): Promise<Content[]> {
    return Array.from(this.contents.values());
  }

  async createContent(insertContent: InsertContent): Promise<Content> {
    const id = this.contentId++;
    
    // Create content with proper default values for all fields
    const content: Content = { 
      id,
      type: insertContent.type,
      title: insertContent.title,
      content: insertContent.content,
      order: insertContent.order,
      courseId: insertContent.courseId,
      thumbnailUrl: insertContent.thumbnailUrl ?? null,
      textContent: insertContent.textContent ?? null,
      videoUrl: insertContent.videoUrl ?? null,
      videoItems: (insertContent.videoItems ?? []) as VideoItem[],
      pdfUrl: insertContent.pdfUrl ?? null,
      pdfItems: (insertContent.pdfItems ?? []) as PDFItem[],
      quizContent: insertContent.quizContent ?? null,
      display_order: insertContent.display_order ?? null
    };
    
    this.contents.set(id, content);
    return content;
  }

  async updateContent(id: number, content: Partial<InsertContent>): Promise<Content | undefined> {
    const existingContent = this.contents.get(id);
    if (!existingContent) return undefined;
    
    const updatedContent = { ...existingContent, ...content };
    this.contents.set(id, updatedContent);
    return updatedContent;
  }

  async deleteContent(id: number): Promise<boolean> {
    return this.contents.delete(id);
  }

  // Enrollment operations
  async getEnrollment(id: number): Promise<Enrollment | undefined> {
    return this.enrollments.get(id);
  }

  async getEnrollmentsByUser(userId: number): Promise<Enrollment[]> {
    return Array.from(this.enrollments.values()).filter(
      (enrollment) => enrollment.userId === userId
    );
  }

  async getEnrollmentsByCourse(courseId: number): Promise<Enrollment[]> {
    return Array.from(this.enrollments.values()).filter(
      (enrollment) => enrollment.courseId === courseId
    );
  }

  async createEnrollment(insertEnrollment: InsertEnrollment): Promise<Enrollment> {
    const id = this.enrollmentId++;
    const enrolledAt = new Date();
    
    // Create enrollment with proper default values for all fields
    const enrollment: Enrollment = { 
      id,
      courseId: insertEnrollment.courseId,
      userId: insertEnrollment.userId,
      progress: insertEnrollment.progress ?? 0,
      completed: insertEnrollment.completed ?? false,
      enrolledAt,
      accessDuration: insertEnrollment.accessDuration ?? null,
      expiresAt: insertEnrollment.expiresAt ?? null,
      paymentType: insertEnrollment.paymentType ?? "full",
      paymentStatus: insertEnrollment.paymentStatus ?? "completed",
      installmentsPaid: insertEnrollment.installmentsPaid ?? 0,
      totalInstallments: insertEnrollment.totalInstallments ?? 1,
      paymentPlanId: insertEnrollment.paymentPlanId ?? null,
      stripeSubscriptionId: insertEnrollment.stripeSubscriptionId ?? null,
      stripeCustomerId: insertEnrollment.stripeCustomerId ?? null
    };
    
    // If this is a payment plan enrollment, update the installment information
    if (enrollment.paymentType === "installment" && enrollment.paymentPlanId) {
      const plan = await this.getPaymentPlan(enrollment.paymentPlanId);
      if (plan) {
        enrollment.totalInstallments = plan.installments;
        enrollment.installmentsPaid = 1; // First installment is paid immediately
        enrollment.paymentStatus = "active";
        
        // Set access duration based on payment plan if not already set
        if (!enrollment.accessDuration) {
          enrollment.accessDuration = plan.installments;
          
          // Set expiration date if not already set
          if (!enrollment.expiresAt) {
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + plan.installments);
            enrollment.expiresAt = expiresAt;
          }
        }
      }
    }
    
    // For one-time payments, set default 12-month access duration if not specified
    if (enrollment.paymentType === "full" && !enrollment.accessDuration) {
      enrollment.accessDuration = 12; // Default to 12 months for full payments
      
      if (!enrollment.expiresAt) {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 12);
        enrollment.expiresAt = expiresAt;
      }
    }
    
    this.enrollments.set(id, enrollment);
    return enrollment;
  }

  async updateEnrollment(id: number, enrollment: Partial<InsertEnrollment>): Promise<Enrollment | undefined> {
    const existingEnrollment = this.enrollments.get(id);
    if (!existingEnrollment) return undefined;
    
    const updatedEnrollment = { ...existingEnrollment, ...enrollment };
    this.enrollments.set(id, updatedEnrollment);
    return updatedEnrollment;
  }

  async deleteEnrollment(id: number): Promise<boolean> {
    return this.enrollments.delete(id);
  }

  // Progress operations
  async getProgress(id: number): Promise<Progress | undefined> {
    return this.progresses.get(id);
  }

  async getProgressByUser(userId: number): Promise<Progress[]> {
    return Array.from(this.progresses.values()).filter(
      (progress) => progress.userId === userId
    );
  }

  async getProgressByContent(contentId: number): Promise<Progress[]> {
    return Array.from(this.progresses.values()).filter(
      (progress) => progress.contentId === contentId
    );
  }

  async getProgressByUserAndContent(userId: number, contentId: number): Promise<Progress | undefined> {
    return Array.from(this.progresses.values()).find(
      (progress) => progress.userId === userId && progress.contentId === contentId
    );
  }

  async createOrUpdateProgress(insertProgress: InsertProgress): Promise<Progress> {
    // Check if there's existing progress
    const existingProgress = await this.getProgressByUserAndContent(
      insertProgress.userId,
      insertProgress.contentId
    );
    
    if (existingProgress) {
      // Update existing progress
      const completedAt = insertProgress.completed ? new Date() : existingProgress.completedAt;
      
      // Keep existing mood data if not provided in the update
      const mood = insertProgress.mood || existingProgress.mood;
      const moodNote = insertProgress.moodNote || existingProgress.moodNote;
      
      const updatedProgress = { 
        ...existingProgress, 
        ...insertProgress, 
        completedAt,
        mood,
        moodNote
      };
      
      this.progresses.set(existingProgress.id, updatedProgress);
      
      // Update enrollment progress
      await this.updateEnrollmentProgress(insertProgress.userId, insertProgress.contentId);
      
      return updatedProgress;
    } else {
      // Create new progress
      const id = this.progressId++;
      const completedAt = insertProgress.completed ? new Date() : null;
      
      const progress: Progress = { 
        id, 
        contentId: insertProgress.contentId,
        userId: insertProgress.userId,
        completed: insertProgress.completed ?? false,
        completedAt,
        mood: insertProgress.mood ?? null, 
        moodNote: insertProgress.moodNote ?? null 
      };
      
      this.progresses.set(id, progress);
      
      // Update enrollment progress
      await this.updateEnrollmentProgress(insertProgress.userId, insertProgress.contentId);
      
      return progress;
    }
  }

  // Helper to update enrollment progress percentage
  private async updateEnrollmentProgress(userId: number, contentId: number): Promise<void> {
    // Find the content to get courseId
    const content = await this.getContent(contentId);
    if (!content) return;
    
    const courseId = content.courseId;
    
    // Find all contents for the course
    const allContents = await this.getContentsByCourse(courseId);
    const allContentIds = allContents.map(c => c.id);
    
    // Get all progress for this user and course's content
    const userProgress = await this.getProgressByUser(userId);
    const courseProgress = userProgress.filter(p => 
      allContentIds.includes(p.contentId) && p.completed
    );
    
    // Calculate progress percentage
    const progressPercentage = allContentIds.length > 0 
      ? Math.round((courseProgress.length / allContentIds.length) * 100)
      : 0;
    
    // Find and update the enrollment
    const userEnrollments = await this.getEnrollmentsByUser(userId);
    const enrollment = userEnrollments.find(e => e.courseId === courseId);
    
    if (enrollment) {
      await this.updateEnrollment(enrollment.id, {
        progress: progressPercentage,
        completed: progressPercentage === 100,
      });
    }
  }

  async deleteProgress(id: number): Promise<boolean> {
    return this.progresses.delete(id);
  }

  // Category operations
  async getCategory(id: number): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    return Array.from(this.categories.values()).find(
      (category) => category.name.toLowerCase() === name.toLowerCase()
    );
  }

  async getAllCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = this.categoryId++;
    
    // Create category with proper default values
    const category: Category = { 
      id,
      name: insertCategory.name,
      icon: insertCategory.icon,
      imageUrl: insertCategory.imageUrl ?? null,
      courseCount: insertCategory.courseCount ?? 0
    };
    
    this.categories.set(id, category);
    return category;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const existingCategory = this.categories.get(id);
    if (!existingCategory) return undefined;
    
    const updatedCategory = { ...existingCategory, ...category };
    this.categories.set(id, updatedCategory);
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<boolean> {
    return this.categories.delete(id);
  }

  // Comment operations
  async getComment(id: number): Promise<Comment | undefined> {
    return this.comments.get(id);
  }

  async getCommentsByContent(contentId: number): Promise<Comment[]> {
    return Array.from(this.comments.values())
      .filter(comment => comment.contentId === contentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCommentsByUser(userId: number): Promise<Comment[]> {
    return Array.from(this.comments.values())
      .filter(comment => comment.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createComment(comment: InsertComment & { userId: number }): Promise<Comment> {
    const id = this.commentId++;
    const createdAt = new Date();
    
    // Create comment with proper default values
    const newComment: Comment = { 
      id,
      createdAt,
      userId: comment.userId,
      contentId: comment.contentId,
      text: comment.text,
      parentId: comment.parentId ?? null
    };
    
    this.comments.set(id, newComment);
    return newComment;
  }

  async deleteComment(id: number): Promise<boolean> {
    return this.comments.delete(id);
  }

  // Admin statistics
  async getAdminStats(): Promise<any> {
    const totalUsers = this.users.size;
    const totalCourses = this.courses.size;
    const totalEnrollments = this.enrollments.size;
    const totalCompletions = Array.from(this.enrollments.values()).filter(e => e.completed).length;
    
    // Calculate revenue (sum of course prices for all enrollments)
    let revenue = 0;
    for (const enrollment of this.enrollments.values()) {
      const course = await this.getCourse(enrollment.courseId);
      if (course) {
        revenue += course.price;
      }
    }
    
    // Recent users
    const recentUsers = Array.from(this.users.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);
    
    // Recent enrollments
    const recentEnrollments = Array.from(this.enrollments.values())
      .sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime())
      .slice(0, 5);
    
    const enrichedEnrollments = await Promise.all(recentEnrollments.map(async (enrollment) => {
      const user = await this.getUser(enrollment.userId);
      const course = await this.getCourse(enrollment.courseId);
      return {
        id: enrollment.id,
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        userName: user?.username || "Unknown",
        userEmail: user?.email || "Unknown",
        courseName: course?.title || "Unknown",
        amount: course?.price || 0,
        date: enrollment.enrolledAt,
      };
    }));
    
    return {
      totalUsers,
      totalCourses,
      totalEnrollments,
      totalCompletions,
      revenue,
      recentUsers,
      recentEnrollments: enrichedEnrollments,
    };
  }
  
  // Migration support
  async runMigrations(migrationType: any): Promise<void> {
    console.log(`MemStorage: Running migrations of type:`, migrationType);
    
    // Implementation is handled at the API level for specific migrations
    // This is just a placeholder method to satisfy the interface
  }
  
  // Streaming manifest operations
  async getStreamingManifest(contentId: number, videoFileKey: string): Promise<StreamingManifest | undefined> {
    return Array.from(this.streamingManifests.values()).find(
      manifest => manifest.contentId === contentId && manifest.videoFileKey === videoFileKey
    );
  }
  
  async saveStreamingManifest(manifest: InsertStreamingManifest): Promise<StreamingManifest> {
    const id = this.manifestId++;
    const created = new Date();
    
    const streamingManifest: StreamingManifest = {
      id,
      contentId: manifest.contentId,
      videoFileKey: manifest.videoFileKey,
      path: manifest.path,
      url: manifest.url,
      s3Key: manifest.s3Key ?? null,
      format: manifest.format,
      created,
      lastAccessed: null
    };
    
    this.streamingManifests.set(id, streamingManifest);
    return streamingManifest;
  }
  
  async updateStreamingManifestAccess(id: number): Promise<boolean> {
    const manifest = this.streamingManifests.get(id);
    if (!manifest) return false;
    
    manifest.lastAccessed = new Date();
    this.streamingManifests.set(id, manifest);
    return true;
  }
  
  async getMediaUrl(fileKey: string): Promise<string> {
    // This is a convenience method to handle media URL generation
    // For S3 integration, this will check if there's an existing CDN URL or generate a presigned URL
    // In memory storage just returns the file key as-is (the real implementation is in the s3.ts file)
    return fileKey;
  }
  
  async getRandomUnshownReview(): Promise<VsReview | undefined> {
    // Stub implementation - not used in production
    return undefined;
  }
  
  async resetAllReviews(): Promise<void> {
    // Stub implementation - not used in production
  }
}

export class DatabaseStorage implements IStorage {
  sessionStore: Store;

  constructor() {
    // Use memory store for sessions with HTTP database adapter
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
    
    // Initialize database with admin user and default data
    this.initializeData();
  }
  
  // Helper method to map database row to Enrollment object with proper field handling
  private mapRowToEnrollment(typedRow: Record<string, any>): Enrollment {
    return {
      id: Number(typedRow.id),
      userId: Number(typedRow.user_id),
      courseId: Number(typedRow.course_id),
      completed: Boolean(typedRow.completed),
      progress: Number(typedRow.progress || 0),
      enrolledAt: new Date(typedRow.enrolled_at),
      accessDuration: typedRow.access_duration !== null ? Number(typedRow.access_duration) : null,
      expiresAt: typedRow.expires_at ? new Date(typedRow.expires_at) : null,
      paymentType: typedRow.payment_type || "full",
      paymentStatus: typedRow.payment_status || "completed",
      paymentPlanId: typedRow.payment_plan_id !== null ? Number(typedRow.payment_plan_id) : null,
      installmentsPaid: typedRow.installments_paid !== null ? Number(typedRow.installments_paid) : null,
      totalInstallments: typedRow.total_installments !== null ? Number(typedRow.total_installments) : null,
      stripeSubscriptionId: typedRow.stripe_subscription_id || null,
      stripeCustomerId: typedRow.stripe_customer_id || null
    };
  }

  private async initializeData(): Promise<void> {
    try {
      console.log("Restoring database connection - existing users should now be accessible");
      
      // Only initialize admin user if it doesn't exist (preserve existing data)
      const existingAdmin = await this.getUserByEmail("Darchiav@gmail.com");
      if (!existingAdmin) {
        await this.initializeAdminUser();
      }
      
      // Only initialize categories if none exist (preserve existing data)
      const existingCategories = await this.getAllCategories();
      if (existingCategories.length === 0) {
        await this.initializeCategories();
      }
      
      // Only initialize courses if none exist (preserve existing data)
      const existingCourses = await this.getAllCourses();
      if (existingCourses.length === 0) {
        await this.initializeCourses();
      }
      
      console.log("Database restoration complete - all existing users preserved");
    } catch (error) {
      console.error("Error restoring database data:", error);
    }
  }

  private async initializeAdminUser(): Promise<void> {
    try {
      const adminEmail = "Darchiav@gmail.com";
      const adminPassword = "Jimbo2345";
      
      // Check if admin user already exists
      const existingAdmin = await this.getUserByEmail(adminEmail);
      if (!existingAdmin) {
        console.log("Creating admin user:", adminEmail);
        await this.createUser({
          username: "Administrator",
          email: adminEmail,
          password: adminPassword,
          isAdmin: true
        });
      }
    } catch (error) {
      console.error("Error initializing admin user:", error);
    }
  }
  
  private async initializeCategories(): Promise<void> {
    try {
      // Check initialization status from the file
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const initFilePath = path.resolve('./server/data/init.json');
      
      let initData = { coursesInitialized: false, categoriesInitialized: false };
      
      try {
        // Try to read the initialization file
        const fileContent = await fs.readFile(initFilePath, 'utf-8');
        initData = JSON.parse(fileContent);
      } catch (readError) {
        // If file doesn't exist or is invalid, we'll create it later
        console.log("Initialization file not found or invalid, will create after initialization.");
      }
      
      // If categories haven't been initialized yet
      if (!initData.categoriesInitialized) {
        const existingCategories = await this.getAllCategories();
        if (existingCategories.length === 0) {
          console.log("Initializing sample categories...");
          for (const category of defaultCategories) {
            await this.createCategory(category);
          }
          
          // Update the initialization file
          initData.categoriesInitialized = true;
          await fs.writeFile(initFilePath, JSON.stringify(initData, null, 2), 'utf-8');
          console.log("Categories initialized and status saved.");
        } else if (existingCategories.length > 0) {
          // If there are already categories but flag is false, update it
          initData.categoriesInitialized = true;
          await fs.writeFile(initFilePath, JSON.stringify(initData, null, 2), 'utf-8');
          console.log("Categories already exist, marked as initialized.");
        }
      }
    } catch (error) {
      console.error("Error in initializeCategories:", error);
    }
  }

  private async initializeCourses(): Promise<void> {
    try {
      // Check initialization status from the file
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const initFilePath = path.resolve('./server/data/init.json');
      
      let initData = { coursesInitialized: false, categoriesInitialized: false };
      
      try {
        // Try to read the initialization file
        const fileContent = await fs.readFile(initFilePath, 'utf-8');
        initData = JSON.parse(fileContent);
      } catch (readError) {
        // If file doesn't exist or is invalid, we'll create it later
        console.log("Initialization file not found or invalid, will create after initialization.");
      }
      
      // If courses haven't been initialized yet
      if (!initData.coursesInitialized) {
        const existingCourses = await this.getAllCourses();
        if (existingCourses.length === 0) {
          console.log("Initializing sample courses...");
          for (const course of defaultCourses) {
            await this.createCourse(course);
          }
          
          // Update the initialization file
          initData.coursesInitialized = true;
          await fs.writeFile(initFilePath, JSON.stringify(initData, null, 2), 'utf-8');
          console.log("Courses initialized and status saved.");
        } else if (existingCourses.length > 0) {
          // If there are already courses but flag is false, update it
          initData.coursesInitialized = true;
          await fs.writeFile(initFilePath, JSON.stringify(initData, null, 2), 'utf-8');
          console.log("Courses already exist, marked as initialized.");
        }
      }
    } catch (error) {
      console.error("Error in initializeCourses:", error);
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${username})`);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      // Make sure email is properly trimmed and valid
      if (!email || typeof email !== 'string') {
        console.warn(`Invalid email provided to getUserByEmail: ${email}`);
        return undefined;
      }

      // Clean the email by trimming whitespace
      const cleanEmail = email.trim();
      
      // Log for better debugging
      console.log(`Looking up user by email: "${cleanEmail}"`);
      
      // Try to find using direct SQL for more flexibility
      const result = await db.execute(
        sql`SELECT * FROM users WHERE LOWER(email) = LOWER(${cleanEmail})`
      );
      
      if (!result.rows || !result.rows.length) {
        console.log(`No user found with email: ${cleanEmail}`);
        // Try a second lookup without exact case matching
        const fallbackResult = await db.execute(
          sql`SELECT * FROM users WHERE email ILIKE ${cleanEmail}`
        );
        
        if (fallbackResult.rows && fallbackResult.rows.length) {
          console.log(`Found user via fallback query for: ${cleanEmail}`);
          const user = fallbackResult.rows[0] as User;
          
          // Normalize the admin property names
          this.normalizeUserAdminField(user);
          
          return user;
        }
        
        return undefined;
      }
      
      const user = result.rows[0] as User;
      
      // Normalize the admin property names
      this.normalizeUserAdminField(user);
      
      console.log(`Found user with email: ${cleanEmail}, user ID: ${user.id}, isAdmin: ${user.isAdmin}`);
      return user;
    } catch (error) {
      console.error(`Error in getUserByEmail for email ${email}:`, error);
      console.error("Error stack:", error instanceof Error ? error.stack : "Unknown error");
      return undefined;
    }
  }
  
  // Helper to ensure admin status is consistently available as isAdmin property
  private normalizeUserAdminField(user: any): void {
    if (!user) return;
    
    // Handle different potential field names for admin status
    if (user.is_admin !== undefined && user.isAdmin === undefined) {
      user.isAdmin = !!user.is_admin;
    } else if (user.isAdmin === undefined) {
      // Default to false if neither property exists
      user.isAdmin = false;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return !!result;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Course operations
  async getCourse(id: number): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course;
  }

  async getAllCourses(): Promise<Course[]> {
    return await db.select().from(courses);
  }

  async getCoursesByCategory(category: string): Promise<Course[]> {
    return await db
      .select()
      .from(courses)
      .where(sql`LOWER(${courses.category}) = LOWER(${category})`);
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    // Add a default modules value of 0
    const [newCourse] = await db.insert(courses).values({
      ...course,
      modules: 0 // Default value for modules field
    }).returning();
    
    // Update category course count
    const category = await this.getCategoryByName(newCourse.category);
    if (category) {
      await this.updateCategory(category.id, { 
        courseCount: category.courseCount + 1 
      });
    }
    
    return newCourse;
  }

  async updateCourse(id: number, courseData: Partial<InsertCourse>): Promise<Course | undefined> {
    // Check if course exists
    const existingCourse = await this.getCourse(id);
    if (!existingCourse) return undefined;
    
    // If category is changing, update category counts
    if (courseData.category && courseData.category !== existingCourse.category) {
      const oldCategory = await this.getCategoryByName(existingCourse.category);
      const newCategory = await this.getCategoryByName(courseData.category);
      
      if (oldCategory) {
        await this.updateCategory(oldCategory.id, { 
          courseCount: Math.max(0, oldCategory.courseCount - 1) 
        });
      }
      
      if (newCategory) {
        await this.updateCategory(newCategory.id, { 
          courseCount: newCategory.courseCount + 1 
        });
      }
    }
    
    // Update course
    const [updatedCourse] = await db
      .update(courses)
      .set({
        ...courseData,
        updatedAt: new Date()
      })
      .where(eq(courses.id, id))
      .returning();
    
    return updatedCourse;
  }

  async deleteCourse(id: number): Promise<boolean> {
    // Get course first for category update
    const course = await this.getCourse(id);
    if (!course) return false;
    
    // Update category count
    const category = await this.getCategoryByName(course.category);
    if (category) {
      await this.updateCategory(category.id, { 
        courseCount: Math.max(0, category.courseCount - 1) 
      });
    }
    
    // Delete course
    await db.delete(courses).where(eq(courses.id, id));
    return true;
  }

  // Payment plan operations
  async getPaymentPlan(id: number): Promise<PaymentPlan | undefined> {
    const [plan] = await db.select().from(paymentPlans).where(eq(paymentPlans.id, id));
    return plan;
  }

  async getPaymentPlansByCourse(courseId: number): Promise<PaymentPlan[]> {
    return await db
      .select()
      .from(paymentPlans)
      .where(and(
        eq(paymentPlans.courseId, courseId),
        eq(paymentPlans.active, true)
      ));
  }

  async createPaymentPlan(plan: InsertPaymentPlan): Promise<PaymentPlan> {
    const [newPlan] = await db.insert(paymentPlans).values(plan).returning();
    return newPlan;
  }

  async updatePaymentPlan(id: number, planData: Partial<InsertPaymentPlan>): Promise<PaymentPlan | undefined> {
    const [updatedPlan] = await db
      .update(paymentPlans)
      .set(planData)
      .where(eq(paymentPlans.id, id))
      .returning();
    return updatedPlan;
  }

  async deletePaymentPlan(id: number): Promise<boolean> {
    await db.delete(paymentPlans).where(eq(paymentPlans.id, id));
    return true;
  }

  // Content operations
  async getContent(id: number): Promise<Content | undefined> {
    try {
      console.log(`Retrieving content with ID ${id}`);
      
      // Use raw SQL to work around the column name discrepancy
      const result = await db.execute(
        sql`SELECT * FROM contents WHERE id = ${id}`
      );
      
      if (!result.rows || result.rows.length === 0) {
        console.log(`No content found with ID ${id}`);
        return undefined;
      }
      
      // Map the database row to our Content type
      const row = result.rows[0] as Record<string, any>;
      
      // Parse video and PDF items using helper function
      const videoItems = safeParseJsonArray(row.video_items, 'video_items', row.id) as VideoItem[];
      const pdfItems = safeParseJsonArray(row.pdf_items, 'pdf_items', row.id) as PDFItem[];
      
      const content: Content = {
        id: Number(row.id),
        courseId: Number(row.module_id), // Map module_id to courseId
        title: String(row.title || ''),
        type: String(row.type || ''),
        content: String(row.content || ''),
        order: Number(row.order || 0), // Use the column name that exists in the database
        thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
        textContent: row.text_content ? String(row.text_content) : null,
        videoUrl: row.video_url ? String(row.video_url) : null,
        videoItems: videoItems,
        youtubeUrl: row.youtube_url ? String(row.youtube_url) : null,
        youtubeName: row.youtube_name ? String(row.youtube_name) : null,
        pdfUrl: row.pdf_url ? String(row.pdf_url) : null,
        pdfItems: pdfItems,
        quizContent: row.quiz_content ? String(row.quiz_content) : null,
        display_order: row.display_order ? String(row.display_order) : null
      };
      
      console.log(`Retrieved content for ID ${id}:`, content);
      return content;
    } catch (error) {
      console.error(`Error retrieving content with ID ${id}:`, error);
      console.error("Error stack:", error instanceof Error ? error.stack : "Unknown error");
      return undefined;
    }
  }

  async getContentsByCourse(courseId: number): Promise<Content[]> {
    try {
      console.log(`Database executing getContentsByCourse for courseId: ${courseId}`);
      
      // Check if the course exists
      const course = await this.getCourse(courseId);
      if (!course) {
        console.log(`Course with ID ${courseId} not found in database`);
        return [];
      }
      
      // Use raw SQL to work around the column name discrepancy
      const result = await db.execute(
        sql`SELECT * FROM contents WHERE module_id = ${courseId} ORDER BY "order", "id"`
      );
      
      if (!result.rows || !Array.isArray(result.rows)) {
        console.log(`No contents found for course ${courseId}`);
        return [];
      }
      
      // Map the database rows to our Content type structure
      const contentItems: Content[] = result.rows.map(row => {
        const typedRow = row as Record<string, any>;
        try {
          // Parse video and PDF items using helper function
          const videoItems = safeParseJsonArray(typedRow.video_items, 'video_items', typedRow.id) as VideoItem[];
          const pdfItems = safeParseJsonArray(typedRow.pdf_items, 'pdf_items', typedRow.id) as PDFItem[];
          
          return {
            id: Number(typedRow.id),
            courseId: Number(typedRow.module_id), // Map module_id to courseId
            title: String(typedRow.title || ''),
            type: String(typedRow.type || ''),
            content: String(typedRow.content || ''),
            order: Number(typedRow.order || 0), // Use the column name that exists in the database
            thumbnailUrl: typedRow.thumbnail_url ? String(typedRow.thumbnail_url) : null,
            textContent: typedRow.text_content ? String(typedRow.text_content) : null,
            videoUrl: typedRow.video_url ? String(typedRow.video_url) : null,
            videoItems: videoItems,
            youtubeUrl: typedRow.youtube_url ? String(typedRow.youtube_url) : null,
            youtubeName: typedRow.youtube_name ? String(typedRow.youtube_name) : null,
            pdfUrl: typedRow.pdf_url ? String(typedRow.pdf_url) : null,
            pdfItems: pdfItems,
            quizContent: typedRow.quiz_content ? String(typedRow.quiz_content) : null,
            display_order: typedRow.display_order ? String(typedRow.display_order) : null
          };
        } catch (e) {
          console.error('Error mapping content row to object', e);
          throw e;
        }
      });
      
      console.log(`Retrieved ${contentItems.length} content items from database for course ${courseId}`);
      console.log(`Retrieved ${contentItems.length} content items for course ${courseId}`);
      return contentItems;
    } catch (error) {
      console.error(`Error in getContentsByCourse (courseId: ${courseId}):`, error);
      console.error("Error stack:", error instanceof Error ? error.stack : "Unknown error");
      // Return empty array on error to ensure function signature is maintained
      return [];
    }
  }
  
  async getAllContents(): Promise<Content[]> {
    try {
      console.log(`Database executing getAllContents`);
      
      // Use raw SQL to work around the column name discrepancy
      const result = await db.execute(
        sql`SELECT * FROM contents ORDER BY module_id, "order", "id"`
      );
      
      if (!result.rows || !Array.isArray(result.rows)) {
        console.log(`No contents found in database`);
        return [];
      }
      
      // Map the database rows to our Content type structure
      const contentItems: Content[] = result.rows.map(row => {
        const typedRow = row as Record<string, any>;
        try {
          // Parse video and PDF items using helper function
          const videoItems = safeParseJsonArray(typedRow.video_items, 'video_items', typedRow.id) as VideoItem[];
          const pdfItems = safeParseJsonArray(typedRow.pdf_items, 'pdf_items', typedRow.id) as PDFItem[];
          
          return {
            id: Number(typedRow.id),
            courseId: Number(typedRow.module_id), // Map module_id to courseId
            title: String(typedRow.title || ''),
            type: String(typedRow.type || ''),
            content: String(typedRow.content || ''),
            order: Number(typedRow.order || 0), // Use the column name that exists in the database
            thumbnailUrl: typedRow.thumbnail_url ? String(typedRow.thumbnail_url) : null,
            textContent: typedRow.text_content ? String(typedRow.text_content) : null,
            videoUrl: typedRow.video_url ? String(typedRow.video_url) : null,
            videoItems: videoItems,
            youtubeUrl: typedRow.youtube_url ? String(typedRow.youtube_url) : null,
            pdfUrl: typedRow.pdf_url ? String(typedRow.pdf_url) : null,
            pdfItems: pdfItems,
            quizContent: typedRow.quiz_content ? String(typedRow.quiz_content) : null,
            display_order: typedRow.display_order ? String(typedRow.display_order) : null
          };
        } catch (e) {
          console.error('Error mapping content row to object', e);
          throw e;
        }
      });
      
      console.log(`Retrieved ${contentItems.length} content items from database`);
      // Add YouTube name field to each content item
      const contentItemsWithYoutubeName = contentItems.map(item => ({
        ...item,
        youtubeName: (result.rows.find((row: any) => row.id === item.id) as any)?.youtube_name || null
      }));
      return contentItemsWithYoutubeName;
    } catch (error) {
      console.error(`Error in getAllContents:`, error);
      console.error("Error stack:", error instanceof Error ? error.stack : "Unknown error");
      // Return empty array on error to ensure function signature is maintained
      return [];
    }
  }

  async createContent(content: InsertContent): Promise<Content> {
    try {
      // Ensure all required fields are present and adapt for database column names
      const contentValues: any = {
        // The schema has been defined with courseId, but the database might have module_id
        module_id: content.courseId, // Use the old column name that exists in the database
        title: content.title,
        type: content.type || 'mixed',
        content: content.content || 'Content',
        order: content.order,
        // Handle optional fields by setting them to null if undefined
        thumbnail_url: content.thumbnailUrl || null,
        text_content: content.textContent || null,
        video_url: content.videoUrl || null,
        youtube_url: content.youtubeUrl || null,
        youtube_name: content.youtubeName || null,
        
        // Properly handle videoItems - ensure it's a valid array before serializing
        video_items: (() => {
          console.log('Processing videoItems for storage:', content.videoItems);
          if (Array.isArray(content.videoItems)) {
            const jsonString = JSON.stringify(content.videoItems);
            console.log('Serialized videoItems to JSON:', jsonString);
            return jsonString;
          } else if (content.videoItems === null) {
            return null;
          } else if (typeof content.videoItems === 'string') {
            try {
              // If it's already a JSON string, validate it
              const parsed = JSON.parse(content.videoItems);
              if (Array.isArray(parsed)) {
                console.log('videoItems was already a JSON string, validated as array');
                return content.videoItems;
              }
            } catch (e) {
              console.error('Invalid JSON string in videoItems:', e);
            }
          }
          console.log('Using empty array for videoItems');
          return '[]';
        })(),
            
        pdf_url: content.pdfUrl || null,
        
        // Properly handle pdfItems - ensure it's a valid array before serializing
        pdf_items: (() => {
          console.log('Processing pdfItems for storage:', content.pdfItems);
          if (Array.isArray(content.pdfItems)) {
            const jsonString = JSON.stringify(content.pdfItems);
            console.log('Serialized pdfItems to JSON:', jsonString);
            return jsonString;
          } else if (content.pdfItems === null) {
            return null;
          } else if (typeof content.pdfItems === 'string') {
            try {
              // If it's already a JSON string, validate it
              const parsed = JSON.parse(content.pdfItems);
              if (Array.isArray(parsed)) {
                console.log('pdfItems was already a JSON string, validated as array');
                return content.pdfItems;
              }
            } catch (e) {
              console.error('Invalid JSON string in pdfItems:', e);
            }
          }
          console.log('Using empty array for pdfItems');
          return '[]';
        })(),
        quiz_content: content.quizContent || null,
        display_order: content.display_order || null
      };
      
      console.log("Preparing to insert content with values:", JSON.stringify(contentValues, null, 2));
      
      // Use raw SQL to insert the content to handle column name differences
      const result = await db.execute(
        sql`INSERT INTO contents 
          (module_id, title, type, content, "order", thumbnail_url, text_content, video_url, video_items, pdf_url, pdf_items, quiz_content, display_order) 
          VALUES 
          (${contentValues.module_id}, ${contentValues.title}, ${contentValues.type}, ${contentValues.content}, ${contentValues.order}, 
           ${contentValues.thumbnail_url}, ${contentValues.text_content}, ${contentValues.video_url}, ${contentValues.video_items}, 
           ${contentValues.pdf_url}, ${contentValues.pdf_items}, ${contentValues.quiz_content}, ${contentValues.display_order})
          RETURNING *`
      );
      
      console.log("SQL insert result:", result);
      
      if (result.rows && result.rows.length > 0) {
        // Map the database result back to our Content type
        const row = result.rows[0] as Record<string, any>;
        
        // Parse video and PDF items using helper function
        const videoItems = safeParseJsonArray(row.video_items, 'video_items', row.id) as VideoItem[];
        const pdfItems = safeParseJsonArray(row.pdf_items, 'pdf_items', row.id) as PDFItem[];
        
        const newContent: Content = {
          id: Number(row.id),
          courseId: Number(row.module_id), // Map module_id back to courseId
          title: String(row.title || ''),
          type: String(row.type || ''),
          content: String(row.content || ''),
          order: Number(row.order || 0), // Use the column name that exists in the database
          thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
          textContent: row.text_content ? String(row.text_content) : null,
          videoUrl: row.video_url ? String(row.video_url) : null,
          videoItems: videoItems,
          pdfUrl: row.pdf_url ? String(row.pdf_url) : null,
          pdfItems: pdfItems,
          quizContent: row.quiz_content ? String(row.quiz_content) : null,
          display_order: row.display_order ? String(row.display_order) : null
        };
        
        console.log("Mapped content from DB:", newContent);
        return newContent;
      }
      
      throw new Error("Content insertion did not return a result");
    } catch (error) {
      console.error('Error creating content in database:', error);
      throw error;
    }
  }

  async updateContent(id: number, contentData: Partial<InsertContent>): Promise<Content | undefined> {
    try {
      console.log(`Updating content with ID ${id} with data:`, contentData);
      
      // We need to map the schema field names to the database column names
      const columnData: Record<string, any> = {};
      
      // Map each field to their appropriate column name in the database
      if (contentData.courseId !== undefined) columnData.module_id = contentData.courseId;
      if (contentData.title !== undefined) columnData.title = contentData.title;
      if (contentData.type !== undefined) columnData.type = contentData.type;
      if (contentData.content !== undefined) columnData.content = contentData.content;
      if (contentData.order !== undefined) columnData["order"] = contentData.order; // Fix: 'order' is a SQL reserved keyword, using quoted column name
      if (contentData.thumbnailUrl !== undefined) columnData.thumbnail_url = contentData.thumbnailUrl;
      if (contentData.textContent !== undefined) columnData.text_content = contentData.textContent;
      if (contentData.videoUrl !== undefined) columnData.video_url = contentData.videoUrl;
      if (contentData.youtubeUrl !== undefined) columnData.youtube_url = contentData.youtubeUrl;
      if (contentData.youtubeName !== undefined) columnData.youtube_name = contentData.youtubeName;
      
      // Properly handle videoItems - ensure it's a valid array before serializing
      if (contentData.videoItems !== undefined) {
        columnData.video_items = (() => {
          console.log('Processing videoItems for update:', JSON.stringify(contentData.videoItems, null, 2));
          
          if (Array.isArray(contentData.videoItems)) {
            // Make sure each item has required properties
            const validItems = contentData.videoItems.filter(item => {
              const isValid = item && typeof item === 'object' && item.name && item.url;
              if (!isValid) {
                console.warn('Found invalid video item, filtering out:', item);
              }
              return isValid;
            });
            
            // Log the valid items we're keeping
            console.log(`Found ${validItems.length} valid video items out of ${contentData.videoItems.length}`);
            
            const jsonString = JSON.stringify(validItems);
            console.log('Serialized videoItems to JSON for update:', jsonString);
            return jsonString;
          } else if (contentData.videoItems === null) {
            console.log('videoItems is null, returning null');
            return null;
          } else if (typeof contentData.videoItems === 'string') {
            try {
              // If it's already a JSON string, validate it
              const parsed = JSON.parse(contentData.videoItems);
              if (Array.isArray(parsed)) {
                console.log('videoItems was already a JSON string, validated as array');
                return contentData.videoItems;
              }
            } catch (e) {
              console.error('Invalid JSON string in videoItems during update:', e);
            }
          }
          console.log('Using empty array for videoItems during update');
          return '[]';
        })();
      }
      
      if (contentData.pdfUrl !== undefined) columnData.pdf_url = contentData.pdfUrl;
      
      // Properly handle pdfItems - ensure it's a valid array before serializing
      if (contentData.pdfItems !== undefined) {
        columnData.pdf_items = (() => {
          console.log('Processing pdfItems for update:', JSON.stringify(contentData.pdfItems, null, 2));
          
          if (Array.isArray(contentData.pdfItems)) {
            // Make sure each item has required properties
            const validItems = contentData.pdfItems.filter(item => {
              const isValid = item && typeof item === 'object' && item.name && item.url;
              if (!isValid) {
                console.warn('Found invalid PDF item, filtering out:', item);
              }
              return isValid;
            });
            
            // Log the valid items we're keeping
            console.log(`Found ${validItems.length} valid PDF items out of ${contentData.pdfItems.length}`);
            
            const jsonString = JSON.stringify(validItems);
            console.log('Serialized pdfItems to JSON for update:', jsonString);
            return jsonString;
          } else if (contentData.pdfItems === null) {
            console.log('pdfItems is null, returning null');
            return null;
          } else if (typeof contentData.pdfItems === 'string') {
            try {
              // If it's already a JSON string, validate it
              const parsed = JSON.parse(contentData.pdfItems);
              if (Array.isArray(parsed)) {
                console.log('pdfItems was already a JSON string, validated as array');
                return contentData.pdfItems;
              }
            } catch (e) {
              console.error('Invalid JSON string in pdfItems during update:', e);
            }
          }
          console.log('Using empty array for pdfItems during update');
          return '[]';
        })();
      }
      if (contentData.quizContent !== undefined) columnData.quiz_content = contentData.quizContent;
      if (contentData.display_order !== undefined) columnData.display_order = contentData.display_order;
      
      console.log("Mapped column data for update:", columnData);
      
      // If nothing to update, just return the existing content
      if (Object.keys(columnData).length === 0) {
        return await this.getContent(id);
      }
      
      // Use proper SQL escaping to prevent SQL injection
      const setClauseParts = Object.entries(columnData).map(([col, val]) => {
        // Quote column names and properly escape values
        if (val === null) {
          return `"${col}" = NULL`;
        } else if (typeof val === 'string') {
          // Escape single quotes by doubling them
          const escapedVal = val.replace(/'/g, "''");
          return `"${col}" = '${escapedVal}'`;
        } else {
          return `"${col}" = ${val}`;
        }
      });
      
      const sqlQuery = `
        UPDATE contents 
        SET ${setClauseParts.join(', ')} 
        WHERE id = ${id} 
        RETURNING *
      `;
      
      console.log("Executing update SQL with escaped values");
      console.log("Column data being updated:", columnData);
      
      const result = await db.execute(sql.raw(sqlQuery));
      
      if (result.rows && result.rows.length > 0) {
        // Map the database result back to our Content type
        const row = result.rows[0] as Record<string, any>;
        
        // Parse video and PDF items using helper function
        const videoItems = safeParseJsonArray(row.video_items, 'video_items', row.id) as VideoItem[];
        const pdfItems = safeParseJsonArray(row.pdf_items, 'pdf_items', row.id) as PDFItem[];
        
        const updatedContent: Content = {
          id: Number(row.id),
          courseId: Number(row.module_id), // Map module_id back to courseId
          title: String(row.title || ''),
          type: String(row.type || ''),
          content: String(row.content || ''),
          order: Number(row.order || 0), // Use the column name that exists in the database
          thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
          textContent: row.text_content ? String(row.text_content) : null,
          videoUrl: row.video_url ? String(row.video_url) : null,
          videoItems: videoItems,
          youtubeUrl: row.youtube_url ? String(row.youtube_url) : null,
          youtubeName: row.youtube_name ? String(row.youtube_name) : null,
          pdfUrl: row.pdf_url ? String(row.pdf_url) : null,
          pdfItems: pdfItems,
          quizContent: row.quiz_content ? String(row.quiz_content) : null,
          display_order: row.display_order ? String(row.display_order) : null
        };
        
        console.log("Content updated successfully:", updatedContent);
        return updatedContent;
      }
      
      console.log("No content found with ID", id);
      return undefined;
    } catch (error) {
      console.error(`Error updating content with ID ${id}:`, error);
      console.error("Error stack:", error instanceof Error ? error.stack : "Unknown error");
      throw error;
    }
  }

  async deleteContent(id: number): Promise<boolean> {
    try {
      console.log(`Deleting content with ID ${id}`);
      // Use raw SQL to delete content
      await db.execute(sql`DELETE FROM contents WHERE id = ${id}`);
      console.log(`Successfully deleted content with ID ${id}`);
      return true;
    } catch (error) {
      console.error(`Error deleting content with ID ${id}:`, error);
      console.error("Error stack:", error instanceof Error ? error.stack : "Unknown error");
      return false;
    }
  }

  // Enrollment operations
  async getEnrollment(id: number): Promise<Enrollment | undefined> {
    try {
      console.log(`Retrieving enrollment with ID ${id}`);
      
      // Use raw SQL to work around schema differences
      const result = await db.execute(
        sql`SELECT e.*, c.title as course_title, c.price as course_price 
            FROM enrollments e 
            JOIN courses c ON e.course_id = c.id 
            WHERE e.id = ${id}`
      );
      
      if (!result.rows || result.rows.length === 0) {
        console.log(`No enrollment found with ID ${id}`);
        return undefined;
      }
      
      // Map the database row to our Enrollment type using our helper function
      const typedRow = result.rows[0] as Record<string, any>;
      const enrollment = this.mapRowToEnrollment(typedRow);
      
      console.log(`Retrieved enrollment with ID ${id}`);
      return enrollment;
    } catch (error) {
      console.error(`Error retrieving enrollment with ID ${id}:`, error);
      console.error("Error stack:", error instanceof Error ? error.stack : "Unknown error");
      return undefined;
    }
  }

  async getEnrollmentsByUser(userId: number): Promise<Enrollment[]> {
    try {
      console.log(`Retrieving enrollments for user ID ${userId}`);
      
      // Use raw SQL to work around schema differences and join with courses for additional data
      const result = await db.execute(
        sql`SELECT e.*, c.title as course_title, c.price as course_price 
            FROM enrollments e 
            JOIN courses c ON e.course_id = c.id 
            WHERE e.user_id = ${userId}`
      );
      
      if (!result.rows || !Array.isArray(result.rows)) {
        console.log(`No enrollments found for user ${userId}`);
        return [];
      }
      
      // Map the database rows to our Enrollment type using our helper function
      const enrollmentItems: Enrollment[] = result.rows.map(row => {
        return this.mapRowToEnrollment(row as Record<string, any>);
      });
      
      console.log(`Retrieved ${enrollmentItems.length} enrollments for user ${userId}`);
      return enrollmentItems;
    } catch (error) {
      console.error(`Error in getEnrollmentsByUser (userId: ${userId}):`, error);
      console.error("Error stack:", error instanceof Error ? error.stack : "Unknown error");
      // Return empty array on error to ensure function signature is maintained
      return [];
    }
  }

  async getEnrollmentsByCourse(courseId: number): Promise<Enrollment[]> {
    try {
      console.log(`Retrieving enrollments for course ID ${courseId}`);
      
      // Use raw SQL to work around schema differences and join with users for additional data
      const result = await db.execute(
        sql`SELECT e.*, u.username as user_name, u.email as user_email 
            FROM enrollments e 
            JOIN users u ON e.user_id = u.id 
            WHERE e.course_id = ${courseId}`
      );
      
      if (!result.rows || !Array.isArray(result.rows)) {
        console.log(`No enrollments found for course ${courseId}`);
        return [];
      }
      
      // Map the database rows to our Enrollment type using our helper function
      const enrollmentItems: Enrollment[] = result.rows.map(row => {
        return this.mapRowToEnrollment(row as Record<string, any>);
      });
      
      console.log(`Retrieved ${enrollmentItems.length} enrollments for course ${courseId}`);
      return enrollmentItems;
    } catch (error) {
      console.error(`Error in getEnrollmentsByCourse (courseId: ${courseId}):`, error);
      console.error("Error stack:", error instanceof Error ? error.stack : "Unknown error");
      // Return empty array on error to ensure function signature is maintained
      return [];
    }
  }

  async createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment> {
    try {
      console.log("Creating new enrollment:", enrollment);
      
      // Prepare default values for access duration and expiration
      let accessDuration = enrollment.accessDuration;
      let expiresAt = enrollment.expiresAt;
      
      // If not provided but it's a payment plan enrollment, set based on payment plan
      if (enrollment.paymentType === "installment" && enrollment.paymentPlanId && !accessDuration) {
        const plan = await this.getPaymentPlan(Number(enrollment.paymentPlanId));
        if (plan) {
          accessDuration = plan.installments;
          if (!expiresAt) {
            expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + plan.installments);
          }
        }
      }
      
      // For one-time payments, set default 12-month access duration if not specified
      if (enrollment.paymentType === "full" && !accessDuration) {
        accessDuration = 12; // Default to 12 months for full payments
        if (!expiresAt) {
          expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 12);
        }
      }
      
      // Extract only core fields for database insertion
      // Only include fields that we know exist in the actual database
      const dbEnrollment = {
        user_id: enrollment.userId,
        course_id: enrollment.courseId,
        progress: enrollment.progress || 0,
        completed: enrollment.completed || false,
        access_duration: accessDuration,
        expires_at: expiresAt
        // Payment-related fields are removed to ensure compatibility
      };
      
      // Use raw SQL to insert enrollment with only the fields we know exist in the database
      // This is a more compatible approach that works even if schema has been partially upgraded
      console.log("Creating enrollment with core fields only");
      try {
        const result = await db.execute(
          sql`INSERT INTO enrollments (
              user_id, course_id, progress, completed, 
              access_duration, expires_at
            ) 
            VALUES (
              ${dbEnrollment.user_id}, ${dbEnrollment.course_id}, 
              ${dbEnrollment.progress}, ${dbEnrollment.completed},
              ${dbEnrollment.access_duration}, ${dbEnrollment.expires_at}
            )
            RETURNING *`
        );
        
        if (!result.rows || result.rows.length === 0) {
          throw new Error("Failed to create enrollment");
        }
        
        // Map the database row to our Enrollment type using our helper function
        const typedRow = result.rows[0] as Record<string, any>;
        const newEnrollment = this.mapRowToEnrollment(typedRow);
        
        console.log("Successfully created enrollment:", newEnrollment);
        return newEnrollment;
      } catch (error) {
        console.error("Error executing enrollment creation SQL:", error);
        throw error;
      }
    } catch (error) {
      console.error("Error creating enrollment:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : "Unknown error");
      throw error;
    }
  }

  async updateEnrollment(id: number, enrollmentData: Partial<InsertEnrollment>): Promise<Enrollment | undefined> {
    try {
      console.log(`Updating enrollment with ID ${id}:`, enrollmentData);
      
      // Map fields to their database column names
      const dbEnrollmentData: Record<string, any> = {};
      
      // Map only the core enrollment fields to database column names
      // Skip potentially non-existent columns to ensure compatibility
      if (enrollmentData.userId !== undefined) dbEnrollmentData.user_id = enrollmentData.userId;
      if (enrollmentData.courseId !== undefined) dbEnrollmentData.course_id = enrollmentData.courseId;
      if (enrollmentData.progress !== undefined) dbEnrollmentData.progress = enrollmentData.progress;
      if (enrollmentData.completed !== undefined) dbEnrollmentData.completed = enrollmentData.completed;
      if (enrollmentData.accessDuration !== undefined) dbEnrollmentData.access_duration = enrollmentData.accessDuration;
      if (enrollmentData.expiresAt !== undefined) dbEnrollmentData.expires_at = enrollmentData.expiresAt;
      
      // Skip these fields as they may not exist in the actual database schema
      // if (enrollmentData.paymentType !== undefined) dbEnrollmentData.payment_type = enrollmentData.paymentType;
      // if (enrollmentData.paymentStatus !== undefined) dbEnrollmentData.payment_status = enrollmentData.paymentStatus;
      // if (enrollmentData.paymentPlanId !== undefined) dbEnrollmentData.payment_plan_id = enrollmentData.paymentPlanId;
      // if (enrollmentData.installmentsPaid !== undefined) dbEnrollmentData.installments_paid = enrollmentData.installmentsPaid;
      // if (enrollmentData.totalInstallments !== undefined) dbEnrollmentData.total_installments = enrollmentData.totalInstallments;
      // if (enrollmentData.stripeSubscriptionId !== undefined) dbEnrollmentData.stripe_subscription_id = enrollmentData.stripeSubscriptionId;
      // if (enrollmentData.stripeCustomerId !== undefined) dbEnrollmentData.stripe_customer_id = enrollmentData.stripeCustomerId;
      
      console.log("Database enrollment fields to update:", dbEnrollmentData);
      
      // If nothing to update in the database, get current enrollment and return
      if (Object.keys(dbEnrollmentData).length === 0) {
        return await this.getEnrollment(id);
      }
      
      // Build the SQL update statement
      const setClauseParts = Object.entries(dbEnrollmentData).map(([col, val]) => {
        if (val === null) {
          return `${col} = NULL`;
        } else if (typeof val === 'boolean') {
          return `${col} = ${val ? 'TRUE' : 'FALSE'}`;
        } else if (val instanceof Date) {
          return `${col} = '${val.toISOString()}'`;
        }
        return `${col} = ${typeof val === 'string' ? `'${val}'` : val}`;
      });
      
      // Execute raw SQL update
      const sqlQuery = `
        UPDATE enrollments 
        SET ${setClauseParts.join(', ')} 
        WHERE id = ${id} 
        RETURNING *
      `;
      
      console.log("Executing update SQL:", sqlQuery);
      
      const result = await db.execute(sql.raw(sqlQuery));
      
      if (!result.rows || result.rows.length === 0) {
        console.log(`No enrollment found with ID ${id}`);
        return undefined;
      }
      
      // Map the database row to our Enrollment type using our helper function
      const typedRow = result.rows[0] as Record<string, any>;
      const updatedEnrollment = this.mapRowToEnrollment(typedRow);
      
      console.log("Updated enrollment:", updatedEnrollment);
      return updatedEnrollment;
    } catch (error) {
      console.error(`Error updating enrollment with ID ${id}:`, error);
      console.error("Error stack:", error instanceof Error ? error.stack : "Unknown error");
      return undefined;
    }
  }

  async deleteEnrollment(id: number): Promise<boolean> {
    try {
      console.log(`Deleting enrollment with ID: ${id}`);
      const result = await db.delete(enrollments)
        .where(eq(enrollments.id, id))
        .returning({ id: enrollments.id });
      
      const success = result.length > 0;
      console.log(`Enrollment deletion result: ${success ? 'Success' : 'Failed'}`);
      return success;
    } catch (error) {
      console.error(`Error deleting enrollment ${id}:`, error);
      return false;
    }
  }

  // Temporary helper for webhook processing, returns a Map for compatibility
  getEnrollments(): Map<number, Enrollment> {
    // Create an empty map that will be populated on demand
    return new Map<number, Enrollment>();
  }

  // Progress operations
  async getProgress(id: number): Promise<Progress | undefined> {
    const [progressItem] = await db.select().from(progress).where(eq(progress.id, id));
    return progressItem;
  }

  async getProgressByUser(userId: number): Promise<Progress[]> {
    return await db
      .select()
      .from(progress)
      .where(eq(progress.userId, userId));
  }

  async getProgressByContent(contentId: number): Promise<Progress[]> {
    return await db
      .select()
      .from(progress)
      .where(eq(progress.contentId, contentId));
  }

  async getProgressByUserAndContent(userId: number, contentId: number): Promise<Progress | undefined> {
    const [progressItem] = await db
      .select()
      .from(progress)
      .where(and(
        eq(progress.userId, userId),
        eq(progress.contentId, contentId)
      ));
    return progressItem;
  }

  async createOrUpdateProgress(progressData: InsertProgress): Promise<Progress> {
    try {
      console.log("Creating/updating progress:", progressData);
      
      // Check if progress already exists
      const existingProgress = await this.getProgressByUserAndContent(
        progressData.userId, 
        progressData.contentId
      );
      
      // If progress exists, update it
      if (existingProgress) {
        console.log("Updating existing progress with ID:", existingProgress.id);
        
        const completedAt = progressData.completed && !existingProgress.completed
          ? new Date()
          : existingProgress.completedAt;
        
        // Use raw SQL for update to avoid schema mismatches
        const updateFields = {
          user_id: progressData.userId,
          content_id: progressData.contentId,
          completed: progressData.completed || false,
          completed_at: progressData.completed ? completedAt : null,
          mood: progressData.mood || null,
          mood_note: progressData.moodNote || null
        };
        
        // Build SQL update statement
        const setClauseParts = Object.entries(updateFields).map(([col, val]) => {
          if (val === null) {
            return `${col} = NULL`;
          } else if (typeof val === 'boolean') {
            return `${col} = ${val ? 'TRUE' : 'FALSE'}`;
          } else if (val instanceof Date) {
            return `${col} = '${val.toISOString()}'`;
          }
          return `${col} = ${typeof val === 'string' ? `'${val}'` : val}`;
        });
        
        // Execute SQL update
        const sqlQuery = `
          UPDATE progress 
          SET ${setClauseParts.join(', ')} 
          WHERE id = ${existingProgress.id} 
          RETURNING *
        `;
        
        console.log("Executing progress update SQL:", sqlQuery);
        
        const result = await db.execute(sql.raw(sqlQuery));
        
        if (!result.rows || result.rows.length === 0) {
          throw new Error(`Failed to update progress with ID ${existingProgress.id}`);
        }
        
        // Map the database row to our Progress type
        const typedRow = result.rows[0] as Record<string, any>;
        const updatedProgress: Progress = {
          id: Number(typedRow.id),
          userId: Number(typedRow.user_id),
          contentId: Number(typedRow.content_id),
          completed: Boolean(typedRow.completed),
          completedAt: typedRow.completed_at ? new Date(typedRow.completed_at) : null,
          mood: typedRow.mood || null,
          moodNote: typedRow.mood_note || null
        };
        
        // Update enrollment progress if content was completed
        if (progressData.completed && !existingProgress.completed) {
          await this.updateEnrollmentProgress(progressData.userId, progressData.contentId);
        }
        
        console.log("Progress updated successfully:", updatedProgress);
        return updatedProgress;
      }
      
      // If progress doesn't exist, create it
      console.log("Creating new progress entry");
      
      const completedAt = progressData.completed ? new Date() : null;
      
      // Use raw SQL for insertion to avoid schema mismatches
      const insertFields = {
        user_id: progressData.userId,
        content_id: progressData.contentId,
        completed: progressData.completed || false,
        completed_at: completedAt,
        mood: progressData.mood || null,
        mood_note: progressData.moodNote || null
      };
      
      // Generate column and value lists for SQL INSERT
      const columns = Object.keys(insertFields).join(', ');
      const values = Object.values(insertFields).map(val => {
        if (val === null) {
          return 'NULL';
        } else if (typeof val === 'boolean') {
          return val ? 'TRUE' : 'FALSE';
        } else if (val instanceof Date) {
          return `'${val.toISOString()}'`;
        }
        return typeof val === 'string' ? `'${val}'` : val;
      }).join(', ');
      
      // Execute SQL insert
      const sqlQuery = `
        INSERT INTO progress (${columns})
        VALUES (${values})
        RETURNING *
      `;
      
      console.log("Executing progress insert SQL:", sqlQuery);
      
      const result = await db.execute(sql.raw(sqlQuery));
      
      if (!result.rows || result.rows.length === 0) {
        throw new Error("Failed to create progress entry");
      }
      
      // Map the database row to our Progress type
      const typedRow = result.rows[0] as Record<string, any>;
      const newProgress: Progress = {
        id: Number(typedRow.id),
        userId: Number(typedRow.user_id),
        contentId: Number(typedRow.content_id),
        completed: Boolean(typedRow.completed),
        completedAt: typedRow.completed_at ? new Date(typedRow.completed_at) : null,
        mood: typedRow.mood || null,
        moodNote: typedRow.mood_note || null
      };
      
      // Update enrollment progress if content was completed
      if (progressData.completed) {
        await this.updateEnrollmentProgress(progressData.userId, progressData.contentId);
      }
      
      console.log("Progress created successfully:", newProgress);
      return newProgress;
    } catch (error) {
      console.error("Error in createOrUpdateProgress:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : "Unknown error");
      throw new Error("Failed to update progress");
    }
  }

  // Helper method to update enrollment progress when a content is completed
  private async updateEnrollmentProgress(userId: number, contentId: number): Promise<void> {
    // Find the content to get the course ID
    const content = await this.getContent(contentId);
    if (!content) return;
    
    // Find all content for the course
    const courseContents = await this.getContentsByCourse(content.courseId);
    if (courseContents.length === 0) return;
    
    // Find all progress for the user in this course
    const userProgress = await Promise.all(
      courseContents.map(content => this.getProgressByUserAndContent(userId, content.id))
    );
    
    // Calculate progress percentage
    const completedCount = userProgress.filter(p => p && p.completed).length;
    const progressPercentage = Math.round((completedCount / courseContents.length) * 100);
    
    // Find enrollment for this user and course
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, content.courseId)
      ));
    
    // Update enrollment if found
    if (enrollment) {
      const completed = progressPercentage === 100;
      await this.updateEnrollment(enrollment.id, {
        progress: progressPercentage,
        completed
      });
    }
  }

  async deleteProgress(id: number): Promise<boolean> {
    await db.delete(progress).where(eq(progress.id, id));
    return true;
  }

  // Category operations
  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categories)
      .where(sql`LOWER(${categories.name}) = LOWER(${name})`);
    return category;
  }

  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: number, categoryData: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updatedCategory] = await db
      .update(categories)
      .set(categoryData)
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<boolean> {
    await db.delete(categories).where(eq(categories.id, id));
    return true;
  }

  // Comment operations
  async getComment(id: number): Promise<Comment | undefined> {
    try {
      const [comment] = await db.select().from(comments).where(eq(comments.id, id));
      return comment;
    } catch (error) {
      console.error(`Error getting comment with ID ${id}:`, error);
      return undefined;
    }
  }

  async getCommentsByContent(contentId: number): Promise<Comment[]> {
    try {
      // Get all comments for this content, ordered by creation date (newest first)
      const result = await db
        .select()
        .from(comments)
        .where(eq(comments.contentId, contentId))
        .orderBy(desc(comments.createdAt));
      
      return result;
    } catch (error) {
      console.error(`Error getting comments for content ID ${contentId}:`, error);
      return [];
    }
  }

  async getCommentsByUser(userId: number): Promise<Comment[]> {
    try {
      const result = await db
        .select()
        .from(comments)
        .where(eq(comments.userId, userId))
        .orderBy(desc(comments.createdAt));
      
      return result;
    } catch (error) {
      console.error(`Error getting comments for user ID ${userId}:`, error);
      return [];
    }
  }

  async createComment(comment: InsertComment & { userId: number }): Promise<Comment> {
    try {
      // Insert the comment into the database
      const [newComment] = await db
        .insert(comments)
        .values(comment)
        .returning();
      
      return newComment;
    } catch (error) {
      console.error("Error creating comment:", error);
      throw new Error("Failed to create comment");
    }
  }

  async deleteComment(id: number): Promise<boolean> {
    try {
      await db.delete(comments).where(eq(comments.id, id));
      return true;
    } catch (error) {
      console.error(`Error deleting comment with ID ${id}:`, error);
      return false;
    }
  }

  // Admin statistics
  async getAdminStats(): Promise<any> {
    // Count users
    const [userCount] = await db
      .select({ count: count() })
      .from(users);
    
    // Count courses
    const [courseCount] = await db
      .select({ count: count() })
      .from(courses);
    
    // Count enrollments
    const [enrollmentCount] = await db
      .select({ count: count() })
      .from(enrollments);
    
    // Count completed enrollments
    const [completionCount] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(eq(enrollments.completed, true));
    
    // Calculate revenue (sum of course prices for all enrollments)
    const revenue = await db
      .select({ total: sum(courses.price) })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id));
    
    // Get recent users
    const recentUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(5);
    
    // Get recent enrollments
    const recentEnrollments = await db
      .select({
        id: enrollments.id,
        userId: enrollments.userId,
        courseId: enrollments.courseId,
        date: enrollments.enrolledAt
      })
      .from(enrollments)
      .orderBy(desc(enrollments.enrolledAt))
      .limit(5);
    
    // Enrich enrollments with user and course info
    const enrichedEnrollments = await Promise.all(
      recentEnrollments.map(async (enrollment) => {
        const user = await this.getUser(enrollment.userId);
        const course = await this.getCourse(enrollment.courseId);
        return {
          ...enrollment,
          userName: user?.username || "Unknown",
          userEmail: user?.email || "Unknown",
          courseName: course?.title || "Unknown",
          amount: course?.price || 0
        };
      })
    );
    
    return {
      totalUsers: userCount.count,
      totalCourses: courseCount.count,
      totalEnrollments: enrollmentCount.count,
      totalCompletions: completionCount.count,
      revenue: revenue[0]?.total || 0,
      recentUsers,
      recentEnrollments: enrichedEnrollments
    };
  }
  
  // Migration support
  async runMigrations(migrationType: any): Promise<void> {
    console.log(`DatabaseStorage: Running migrations of type:`, migrationType);
    
    // Implementation is handled at the API level for specific migrations
    // This is just a placeholder method to satisfy the interface
  }
  
  // Streaming manifest operations for adaptive bitrate streaming
  async getStreamingManifest(contentId: number, videoFileKey: string): Promise<StreamingManifest | undefined> {
    try {
      const [manifest] = await db
        .select()
        .from(streamingManifests)
        .where(
          and(
            eq(streamingManifests.contentId, contentId),
            eq(streamingManifests.videoFileKey, videoFileKey)
          )
        );
      return manifest;
    } catch (error) {
      console.error(`Error fetching streaming manifest for contentId ${contentId}, videoFileKey ${videoFileKey}:`, error);
      return undefined;
    }
  }
  
  async saveStreamingManifest(manifest: InsertStreamingManifest): Promise<StreamingManifest> {
    try {
      const [savedManifest] = await db
        .insert(streamingManifests)
        .values({
          ...manifest,
          created: new Date(),
          lastAccessed: null
        })
        .returning();
      
      console.log(`Saved streaming manifest for contentId ${manifest.contentId}, format: ${manifest.format}`);
      return savedManifest;
    } catch (error) {
      console.error(`Error saving streaming manifest:`, error);
      throw error;
    }
  }
  
  async updateStreamingManifestAccess(id: number): Promise<boolean> {
    try {
      const result = await db
        .update(streamingManifests)
        .set({ lastAccessed: new Date() })
        .where(eq(streamingManifests.id, id));
        
      return !!result;
    } catch (error) {
      console.error(`Error updating streaming manifest access for id ${id}:`, error);
      return false;
    }
  }
  
  async getMediaUrl(fileKey: string): Promise<string> {
    // This method delegates to the s3.ts implementation
    // It's here just to satisfy the interface
    // The actual implementation should use the getSignedDownloadUrl from s3.ts
    // or the CDN URL if CDN integration is enabled
    
    try {
      // Import at runtime to avoid circular dependencies
      const { getSignedDownloadUrl } = await import('./s3');
      const url = await getSignedDownloadUrl(fileKey);
      return url;
    } catch (error) {
      console.error(`Error generating media URL for file key ${fileKey}:`, error);
      // Return the file key as a fallback
      return fileKey;
    }
  }
  
  async getRandomUnshownReview(): Promise<VsReview | undefined> {
    try {
      const [review] = await db
        .select()
        .from(vsReviews)
        .where(eq(vsReviews.isShown, false))
        .orderBy(sql`RANDOM()`)
        .limit(1);
      
      if (review) {
        // Mark the review as shown
        await db
          .update(vsReviews)
          .set({ isShown: true })
          .where(eq(vsReviews.id, review.id));
        
        console.log(`Fetched and marked review ${review.id} as shown`);
      }
      
      return review;
    } catch (error) {
      console.error(`Error fetching random unshown review:`, error);
      return undefined;
    }
  }
  
  async resetAllReviews(): Promise<void> {
    try {
      await db
        .update(vsReviews)
        .set({ isShown: false });
      
      console.log(`Reset all VS Dating reviews - all marked as unshown`);
    } catch (error) {
      console.error(`Error resetting all reviews:`, error);
      throw error;
    }
  }
}

// Use DatabaseStorage instead of MemStorage for persistence
// Restore database storage now that connection issues are resolved
export const storage = new DatabaseStorage();
