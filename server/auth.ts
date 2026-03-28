import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

// Export a standalone password utilities object to avoid circular dependencies
export const passwordUtils = {
  async hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  
  async comparePasswords(supplied: string, stored: string) {
    // If no stored password (for regular users without password), always return false
    if (!stored) return false;
    
    // Check if the stored password is in the correct format (hash.salt)
    if (!stored.includes('.')) {
      console.log("Password format issue - not in hash.salt format:", { stored });
      // For admin testing purposes, if the password is stored directly (not hashed)
      // Allow a direct comparison
      return supplied === stored;
    }
    
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) {
      console.log("Password format issue - hash or salt missing:", { hashed, salt });
      return false;
    }
    
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  }
};

// For backward compatibility
export const hashPassword = passwordUtils.hashPassword;
export const comparePasswords = passwordUtils.comparePasswords;

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "dev-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Custom fields for login (using email instead of username)
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
        passReqToCallback: true,
      },
      async (req, email, password, done) => {
        try {
          console.log("Full request body:", req.body);
          
          // Make sure we have an email
          if (!email) {
            console.error("Login attempt with empty email address");
            return done(null, false, { message: "Email address is required" });
          }
          
          // Normalize email for case-insensitive matching
          const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : String(email).trim().toLowerCase();
          console.log(`Looking up user by email: "${email}" (normalized: "${normalizedEmail}")`);
          
          // Try to find user with email (storage.getUserByEmail already handles case-insensitive)
          let user = await storage.getUserByEmail(email);
          
          // If not found, attempt additional recovery steps
          if (!user) {
            console.log(`User not found with primary lookup, trying backup methods`);
            // Get all users and find a case-insensitive match as backup
            const allUsers = await storage.getAllUsers();
            user = allUsers.find(u => u.email && u.email.toLowerCase() === normalizedEmail);
            
            if (user) {
              console.log(`Found user with case-insensitive backup match: ${user.email}`);
            }
          }
          
          if (!user) {
            console.log(`No user found for email: ${email}`);
            return done(null, false, { message: "No account found with this email address" });
          }

          // For admin users, always check password
          if (user.isAdmin) {
            console.log("Admin login attempted", { 
              email, 
              providedPassword: !!password,
              storedPassword: user.password,
              isAdmin: user.isAdmin
            });
            
            // Special case for admin testing: direct comparison if stored is not hashed
            if (password === user.password) {
              console.log("Admin login success: direct password match");
              return done(null, user);
            }
            
            // Otherwise do the regular password check
            if (!password || !(await comparePasswords(password, user.password || ""))) {
              console.log("Admin login failed: password mismatch");
              return done(null, false, { message: "Incorrect password" });
            }
          } else {
            // For regular users, just verify email is valid (email-only authentication)
            console.log("Regular user login", { email });
            // No password check needed for regular users
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }

      const userData = {
        username: req.body.username,
        email: req.body.email,
        password: req.body.password ? await hashPassword(req.body.password) : null,
        isAdmin: req.body.isAdmin || false,
      };

      const user = await storage.createUser(userData);

      req.login(user, (err) => {
        if (err) return next(err);
        // Return user without sensitive data
        const safeUser = { ...user } as any;
        if (safeUser.password) delete safeUser.password;
        res.status(201).json(safeUser);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log("Login attempt:", { email: req.body.email, hasPassword: !!req.body.password });
    
    // Special case for email-only authentication (non-admin users)
    if (req.body.email && !req.body.password) {
      // For non-admin users, we just need to verify the email exists
      (async () => {
        try {
          // Clean the email address
          const email = typeof req.body.email === 'string' ? req.body.email.trim() : String(req.body.email).trim();
          
          console.log(`Attempting email-only login for: "${email}"`);
          
          if (!email) {
            return res.status(400).json({
              message: "Please enter your email address to login",
              errorCode: "EMAIL_REQUIRED"
            });
          }
          
          // Basic email format validation on server side
          const isValidEmailFormat = email.includes('@') && email.split('@')[1]?.includes('.');
          if (!isValidEmailFormat) {
            return res.status(400).json({
              message: "Email format is incorrect. Please use format: name@domain.com",
              errorCode: "INVALID_EMAIL_FORMAT"
            });
          }
          
          // Enhanced error handling for email lookup
          let user: SelectUser | undefined;
          try {
            user = await storage.getUserByEmail(email);
          } catch (dbError) {
            console.error("Database error in email lookup:", dbError);
            return res.status(500).json({ 
              message: "There was a problem connecting to the database. Please try again in a moment.",
              errorCode: "DATABASE_ERROR"
            });
          }
          
          if (!user) {
            console.warn(`User not found for email: ${email}`);
            
            // Log useful information for debugging
            const allUsers = await storage.getAllUsers();
            console.log(`Available users: ${allUsers.length} (first 5):`);
            allUsers.slice(0, 5).forEach(u => {
              console.log(`- ID: ${u.id}, Email: ${u.email}, Admin: ${u.isAdmin}`);
            });
            
            // Try a secondary lookup with case-insensitive comparison
            // This is a backup in case the storage.getUserByEmail failed for some reason
            const secondaryLookup = allUsers.find(u => 
              u.email && u.email.toLowerCase() === email.toLowerCase()
            );
            
            if (secondaryLookup) {
              console.log(`Found user via secondary lookup: ${secondaryLookup.id}`);
              user = secondaryLookup;
            } else {
              // Check if email looks valid but doesn't exist in our system
              if (email.includes('@') && email.includes('.')) {
                return res.status(401).json({ 
                  message: "No account found with this email address. Please check your spelling and try again.",
                  errorCode: "USER_NOT_FOUND" 
                });
              } else {
                return res.status(401).json({ 
                  message: "Email format is incorrect. Please enter a valid email address (example: name@domain.com).",
                  errorCode: "INVALID_EMAIL_FORMAT" 
                });
              }
            }
          }
          
          // If the user is an admin, they need to provide a password
          if (user.isAdmin) {
            console.log("Admin tried to login without password - rejected");
            return res.status(401).json({ message: "Password required for admin users" });
          }
          
          console.log("Email-only login success for user:", { id: user.id, email: user.email });
          
          req.login(user, (err) => {
            if (err) {
              console.error("Session login error:", err);
              return next(err);
            }
            // Return user without sensitive data
            const safeUser = { ...user } as any;
            if (safeUser.password) delete safeUser.password;
            res.status(200).json(safeUser);
          });
        } catch (error) {
          console.error("Unexpected error in login handler:", error);
          next(error);
        }
      })();
      return;
    }
    
    // Standard passport authentication for admin users with password
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.log("Login error:", err);
        return next(err);
      }
      if (!user) {
        console.log("Login failed:", info);
        let errorMessage = "Authentication failed";
        let errorCode = "AUTH_FAILED";
        
        // Provide more specific error messages with error codes
        if (info?.message === "Incorrect email" || info?.message === "No account found with this email address") {
          errorMessage = "Email address not found. Please check your spelling and try again.";
          errorCode = "EMAIL_NOT_FOUND";
        } else if (info?.message === "Incorrect password") {
          errorMessage = "Incorrect password. Please try again or contact an administrator for help.";
          errorCode = "INCORRECT_PASSWORD";
        } else if (info?.message === "Email address is required") {
          errorMessage = "Please enter your email address to login.";
          errorCode = "EMAIL_REQUIRED";
        } else if (info?.message === "Password required for admin users") {
          errorMessage = "Admin users must provide a password to login.";
          errorCode = "ADMIN_PASSWORD_REQUIRED";
        }
        
        return res.status(401).json({ 
          message: errorMessage,
          errorCode: errorCode
        });
      }
      
      console.log("Login success for user:", { id: user.id, email: user.email, isAdmin: user.isAdmin });
      
      // Fix the admin status directly here to ensure it's properly set
      if (typeof user.is_admin === 'boolean') {
        user.isAdmin = user.is_admin;
      }
      
      // Ensure the admin field is normalized as a boolean
      user.isAdmin = !!user.isAdmin;
      
      // Log database information about the user to help debug admin status
      console.log(`User admin status: ${user.isAdmin}`);
      console.log(`User full details for debugging:`, JSON.stringify(user, null, 2));

      // For admin login, verify the user actually has admin rights
      if (req.body.isAdmin) {
        if (!user.isAdmin) {
          console.log("Admin access denied for user:", user.email);
          return res.status(403).json({ message: "Admin access denied" });
        }
        
        // If we get here, user is an admin and password is verified
        console.log("Admin login successful for user:", user.email);
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        // Return user without sensitive data
        const safeUser = { ...user } as any;
        if (safeUser.password) delete safeUser.password;
        res.status(200).json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    // Return user without sensitive data
    const safeUser = { ...req.user } as any;
    if (safeUser.password) delete safeUser.password;
    res.json(safeUser);
  });
}
