import { Express, Request, Response, NextFunction } from "express";
import { webinarStorage } from "./webinar-storage";
import { insertWebinarSchema, insertWebinarAttendeeSchema, insertWebinarChatMessageSchema } from "@shared/schema";
import { z } from "zod";
import { generateRtcToken } from "./agora";
import { WebSocketServer } from 'ws';
import { Server } from 'http';

// Middleware to validate request body against a zod schema
const validateBody = (schema: z.ZodType<any, any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Pre-process dates from string format to Date objects
      if (req.body.scheduledStartTime && typeof req.body.scheduledStartTime === 'string') {
        req.body.scheduledStartTime = new Date(req.body.scheduledStartTime);
      }
      
      if (req.body.scheduledEndTime && typeof req.body.scheduledEndTime === 'string') {
        req.body.scheduledEndTime = new Date(req.body.scheduledEndTime);
      } else if (req.body.scheduledEndTime === null && req.body.scheduledStartTime) {
        // If no end time, default to 2 hours after start time
        const endTime = new Date(req.body.scheduledStartTime);
        endTime.setHours(endTime.getHours() + 2);
        req.body.scheduledEndTime = endTime;
      }

      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      console.error("Validation error:", error);
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error instanceof z.ZodError ? error.errors : undefined 
      });
    }
  };
};

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// Middleware to check if user is an admin
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || !req.user?.isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

// Get webinar owner or ensure user is admin
const isWebinarOwnerOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const webinarId = parseInt(req.params.id);
  if (isNaN(webinarId)) {
    return res.status(400).json({ error: "Invalid webinar ID" });
  }
  
  try {
    const webinar = await webinarStorage.getWebinar(webinarId);
    if (!webinar) {
      return res.status(404).json({ error: "Webinar not found" });
    }
    
    // Allow if user is the host or an admin
    if (webinar.hostId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    // Add webinar to request for use in route handlers
    (req as any).webinar = webinar;
    next();
  } catch (error) {
    console.error("Error in webinar ownership check:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// WebSocket connections map
type WebSocketConnection = {
  ws: WebSocket;
  webinarId: number;
  attendeeId: string;
  isHost: boolean;
  lastPing: number;
};

// Map to track active WebSocket connections
const connections = new Map<string, WebSocketConnection>();

// Helper to broadcast messages to webinar participants
const broadcastToWebinar = (webinarId: number, message: any, excludeAttendeeId?: string) => {
  for (const [id, conn] of connections.entries()) {
    if (conn.webinarId === webinarId && (!excludeAttendeeId || conn.attendeeId !== excludeAttendeeId)) {
      try {
        conn.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending message to connection ${id}:`, error);
        // Remove broken connections
        connections.delete(id);
      }
    }
  }
};

export function registerWebinarRoutes(app: Express, server?: Server) {
  // If server is not provided, don't set up WebSocket functionality
  if (!server) {
    console.warn('WebSocket server not provided to webinar routes - real-time functionality will be disabled');
    // Still set up the REST API endpoints below
  } else {
  // Set up WebSocket server for real-time communication
  const wss = new WebSocketServer({ server, path: '/webinar-ws' });
  
  wss.on('connection', (ws: any) => {
    console.log('WebSocket connection established for webinar');
    let connectionId: string | null = null;
    
    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        
        // Handle different message types
        switch (data.type) {
          case 'join':
            // User joining webinar
            if (data.webinarId && data.attendeeId) {
              connectionId = `${data.webinarId}-${data.attendeeId}`;
              connections.set(connectionId, {
                ws,
                webinarId: data.webinarId,
                attendeeId: data.attendeeId,
                isHost: !!data.isHost,
                lastPing: Date.now()
              });
              
              // Notify others that a new user has joined
              broadcastToWebinar(data.webinarId, {
                type: 'user-joined',
                attendeeId: data.attendeeId,
                timestamp: Date.now()
              }, data.attendeeId);
              
              console.log(`User ${data.attendeeId} joined webinar ${data.webinarId}`);
            }
            break;
            
          case 'chat':
            // Chat message
            if (connectionId && data.message) {
              const conn = connections.get(connectionId);
              if (conn) {
                // Save message to database
                try {
                  const chatMessage = await webinarStorage.createWebinarChatMessage({
                    webinarId: conn.webinarId,
                    attendeeId: conn.attendeeId,
                    userId: data.userId || null,
                    name: data.name,
                    message: data.message,
                    isPrivate: !!data.isPrivate,
                    isQuestion: !!data.isQuestion
                  });
                  
                  // Broadcast message to other users
                  broadcastToWebinar(conn.webinarId, {
                    type: 'chat-message',
                    message: chatMessage
                  });
                } catch (error) {
                  console.error("Error saving chat message:", error);
                  ws.send(JSON.stringify({
                    type: 'error',
                    error: 'Failed to save chat message'
                  }));
                }
              }
            }
            break;
            
          case 'offer-display':
            // Host triggered an offer display
            if (connectionId && data.offerId) {
              const conn = connections.get(connectionId);
              if (conn && conn.isHost) {
                broadcastToWebinar(conn.webinarId, {
                  type: 'display-offer',
                  offerId: data.offerId,
                  duration: data.duration || 60, // Default 1 minute
                  timestamp: Date.now()
                });
              }
            }
            break;
            
          case 'layout-change':
            // Host changed the layout
            if (connectionId && data.layout) {
              const conn = connections.get(connectionId);
              if (conn && conn.isHost) {
                // Update the webinar layout in database
                try {
                  await webinarStorage.updateWebinarLayout(conn.webinarId, data.layout);
                  
                  // Broadcast to all users
                  broadcastToWebinar(conn.webinarId, {
                    type: 'layout-changed',
                    layout: data.layout,
                    timestamp: Date.now()
                  });
                } catch (error) {
                  console.error("Error updating layout:", error);
                }
              }
            }
            break;
            
          case 'highlight-message':
            // Host highlighted a message
            if (connectionId && data.messageId !== undefined) {
              const conn = connections.get(connectionId);
              if (conn && conn.isHost) {
                try {
                  const message = await webinarStorage.highlightChatMessage(
                    data.messageId,
                    !!data.highlighted
                  );
                  
                  if (message) {
                    broadcastToWebinar(conn.webinarId, {
                      type: 'message-highlighted',
                      messageId: data.messageId,
                      highlighted: !!data.highlighted,
                      timestamp: Date.now()
                    });
                  }
                } catch (error) {
                  console.error("Error highlighting message:", error);
                }
              }
            }
            break;
            
          case 'answer-question':
            // Host answered a question
            if (connectionId && data.messageId) {
              const conn = connections.get(connectionId);
              if (conn && conn.isHost) {
                try {
                  const message = await webinarStorage.markQuestionAsAnswered(data.messageId);
                  
                  if (message) {
                    broadcastToWebinar(conn.webinarId, {
                      type: 'question-answered',
                      messageId: data.messageId,
                      timestamp: Date.now()
                    });
                  }
                } catch (error) {
                  console.error("Error marking question as answered:", error);
                }
              }
            }
            break;
            
          case 'ping':
            // Client ping to keep connection alive
            if (connectionId) {
              const conn = connections.get(connectionId);
              if (conn) {
                conn.lastPing = Date.now();
                connections.set(connectionId, conn);
              }
            }
            break;
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });
    
    ws.on('close', () => {
      if (connectionId) {
        const conn = connections.get(connectionId);
        if (conn) {
          // Update attendee leave time
          webinarStorage.updateAttendeeLeaveTime(conn.attendeeId).catch(err => {
            console.error("Error updating attendee leave time:", err);
          });
          
          // Notify others that user has left
          broadcastToWebinar(conn.webinarId, {
            type: 'user-left',
            attendeeId: conn.attendeeId,
            timestamp: Date.now()
          });
          
          // Remove connection
          connections.delete(connectionId);
          console.log(`User ${conn.attendeeId} left webinar ${conn.webinarId}`);
        }
      }
    });
  });
  
  // Set up cleanup interval for stale connections (every 5 minutes)
  setInterval(() => {
    const now = Date.now();
    for (const [id, conn] of connections.entries()) {
      // Remove connections that haven't pinged in 5 minutes
      if (now - conn.lastPing > 5 * 60 * 1000) {
        try {
          conn.ws.close();
        } catch (e) {
          // Ignore errors during close
        }
        connections.delete(id);
        console.log(`Removed stale connection ${id}`);
      }
    }
  }, 5 * 60 * 1000);
  
  } // Close the server conditional block
  
  // === REST API Routes ===
  
  // Get all webinars (admin only)
  app.get('/api/webinars', isAdmin, async (req: Request, res: Response) => {
    try {
      const upcoming = await webinarStorage.getUpcomingWebinars();
      const active = await webinarStorage.getActiveWebinars();
      const past = await webinarStorage.getPastWebinars();
      
      res.json({
        upcoming,
        active,
        past
      });
    } catch (error) {
      console.error("Error getting webinars:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get upcoming webinars (public)
  app.get('/api/webinars/upcoming', async (req: Request, res: Response) => {
    try {
      const webinars = await webinarStorage.getUpcomingWebinars();
      res.json(webinars);
    } catch (error) {
      console.error("Error getting upcoming webinars:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get active webinars (public)
  app.get('/api/webinars/active', async (req: Request, res: Response) => {
    try {
      const webinars = await webinarStorage.getActiveWebinars();
      res.json(webinars);
    } catch (error) {
      console.error("Error getting active webinars:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get webinars by host (for the logged-in user)
  app.get('/api/webinars/my', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const webinars = await webinarStorage.getWebinarsByHost(req.user!.id);
      res.json(webinars);
    } catch (error) {
      console.error("Error getting user's webinars:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get a single webinar by ID
  app.get('/api/webinars/:id', async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      if (isNaN(webinarId)) {
        return res.status(400).json({ error: "Invalid webinar ID" });
      }
      
      const webinar = await webinarStorage.getWebinar(webinarId);
      if (!webinar) {
        return res.status(404).json({ error: "Webinar not found" });
      }
      
      // Check if user is authorized to view full webinar details
      const isOwner = req.isAuthenticated() && req.user!.id === webinar.hostId;
      const isAdmin = req.isAuthenticated() && req.user!.isAdmin;
      
      // For non-owners/admins, only return public info
      if (!isOwner && !isAdmin && webinar.status === 'draft') {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      // For non-owners/admins, filter out sensitive fields
      if (!isOwner && !isAdmin) {
        const { adminRoomId, adminRoomToken, ...publicWebinar } = webinar;
        return res.json(publicWebinar);
      }
      
      res.json(webinar);
    } catch (error) {
      console.error("Error getting webinar:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get a single webinar by unique ID (for public access)
  app.get('/api/webinars/public/:uniqueId', async (req: Request, res: Response) => {
    try {
      const uniqueId = req.params.uniqueId;
      const webinar = await webinarStorage.getWebinarByUniqueId(uniqueId);
      
      if (!webinar) {
        return res.status(404).json({ error: "Webinar not found" });
      }
      
      // Filter out admin-only fields
      const { adminRoomId, adminRoomToken, ...publicWebinar } = webinar;
      res.json(publicWebinar);
    } catch (error) {
      console.error("Error getting webinar by unique ID:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Create a new webinar (admin only)
  app.post('/api/webinars', isAdmin, validateBody(insertWebinarSchema), async (req: Request, res: Response) => {
    try {
      // Prepare webinar data, ensuring all required fields are present
      // Log the incoming data for debugging
      console.log("Received webinar data:", JSON.stringify(req.body, null, 2));
      
      // If createdBy is not set, use the current user's ID
      if (!req.body.createdBy) {
        req.body.createdBy = req.user!.id;
      }
      
      // Note: Date conversion is now handled in the validateBody middleware
      // and the scheduledEndTime is automatically set to 2 hours after start time if null
      
      const webinar = await webinarStorage.createWebinar(req.body);
      res.status(201).json(webinar);
    } catch (error) {
      console.error("Error creating webinar:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Update a webinar (owner or admin only)
  app.put('/api/webinars/:id', isWebinarOwnerOrAdmin, validateBody(insertWebinarSchema.partial()), async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      const updatedWebinar = await webinarStorage.updateWebinar(webinarId, req.body);
      
      if (!updatedWebinar) {
        return res.status(404).json({ error: "Webinar not found" });
      }
      
      res.json(updatedWebinar);
    } catch (error) {
      console.error("Error updating webinar:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Delete a webinar (owner or admin only)
  app.delete('/api/webinars/:id', isWebinarOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      const deleted = await webinarStorage.deleteWebinar(webinarId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Webinar not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting webinar:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Start a webinar (owner or admin only)
  app.post('/api/webinars/:id/start', isWebinarOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      const webinar = await webinarStorage.startWebinar(webinarId);
      
      if (!webinar) {
        return res.status(404).json({ error: "Webinar not found" });
      }
      
      res.json(webinar);
    } catch (error) {
      console.error("Error starting webinar:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // End a webinar (owner or admin only)
  app.post('/api/webinars/:id/end', isWebinarOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      const webinar = await webinarStorage.endWebinar(webinarId);
      
      if (!webinar) {
        return res.status(404).json({ error: "Webinar not found" });
      }
      
      // Broadcast webinar end event to all participants
      broadcastToWebinar(webinarId, {
        type: 'webinar-ended',
        webinarId,
        timestamp: Date.now()
      });
      
      res.json(webinar);
    } catch (error) {
      console.error("Error ending webinar:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get admin token for hosting (owner or admin only)
  app.get('/api/webinars/:id/admin-token', isWebinarOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      const tokens = await webinarStorage.generateWebinarRoomTokens(webinarId);
      
      res.json({
        adminToken: tokens.adminToken,
        adminRoomId: (req as any).webinar.adminRoomId,
        publicRoomId: tokens.publicId
      });
    } catch (error) {
      console.error("Error generating admin token:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get attendee token for joining (public)
  app.post('/api/webinars/:id/join', validateBody(insertWebinarAttendeeSchema), async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      if (isNaN(webinarId)) {
        return res.status(400).json({ error: "Invalid webinar ID" });
      }
      
      const webinar = await webinarStorage.getWebinar(webinarId);
      if (!webinar) {
        return res.status(404).json({ error: "Webinar not found" });
      }
      
      // Check if webinar is available for joining
      if (webinar.status !== 'live' && webinar.status !== 'scheduled') {
        return res.status(400).json({ error: "Webinar is not available for joining" });
      }
      
      // Check if webinar has reached max attendees
      const currentAttendees = await webinarStorage.getCurrentAttendeeCount(webinarId);
      if (currentAttendees >= webinar.maxAttendees) {
        return res.status(400).json({ error: "Webinar has reached maximum capacity" });
      }
      
      // Create attendee record
      const attendeeData = {
        ...req.body,
        webinarId,
        // Add user ID if authenticated
        userId: req.isAuthenticated() ? req.user!.id : null,
        // Add device info
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        deviceType: detectDeviceType(req.headers['user-agent'] || '')
      };
      
      const attendee = await webinarStorage.createWebinarAttendee(attendeeData);
      
      // Generate attendee token
      const token = generateRtcToken(
        webinar.publicRoomId,
        0, // UID 0 means use the account for authentication
        'audience',
        6 * 60 * 60, // 6 hour token
        `attendee_${attendee.attendeeId}`
      );
      
      res.status(201).json({
        attendee,
        token,
        roomId: webinar.publicRoomId
      });
    } catch (error) {
      console.error("Error joining webinar:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get attendees for a webinar (owner or admin only)
  app.get('/api/webinars/:id/attendees', isWebinarOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      const attendees = await webinarStorage.getAttendeesByWebinar(webinarId);
      
      res.json(attendees);
    } catch (error) {
      console.error("Error getting webinar attendees:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get chat messages for a webinar
  app.get('/api/webinars/:id/chat', async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      if (isNaN(webinarId)) {
        return res.status(400).json({ error: "Invalid webinar ID" });
      }
      
      const webinar = await webinarStorage.getWebinar(webinarId);
      if (!webinar) {
        return res.status(404).json({ error: "Webinar not found" });
      }
      
      // Optional query parameters
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const beforeId = req.query.before ? parseInt(req.query.before as string) : undefined;
      
      // Check if user is authorized to view private messages
      const isOwnerOrAdmin = req.isAuthenticated() && 
        (req.user!.id === webinar.hostId || req.user!.isAdmin);
      
      let messages = await webinarStorage.getWebinarChatMessages(webinarId, limit, beforeId);
      
      // Filter out private messages for non-owners/admins
      if (!isOwnerOrAdmin) {
        messages = messages.filter(msg => !msg.isPrivate);
      }
      
      res.json(messages);
    } catch (error) {
      console.error("Error getting chat messages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Post a chat message (REST API alternative to WebSocket)
  app.post('/api/webinars/:id/chat', validateBody(insertWebinarChatMessageSchema), async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      if (isNaN(webinarId)) {
        return res.status(400).json({ error: "Invalid webinar ID" });
      }
      
      const webinar = await webinarStorage.getWebinar(webinarId);
      if (!webinar) {
        return res.status(404).json({ error: "Webinar not found" });
      }
      
      // Check if chat is allowed for this webinar
      if (!webinar.allowChat) {
        return res.status(403).json({ error: "Chat is disabled for this webinar" });
      }
      
      // If it's a question and questions are not allowed
      if (req.body.isQuestion && !webinar.allowQuestions) {
        return res.status(403).json({ error: "Questions are disabled for this webinar" });
      }
      
      // Add user ID if authenticated
      const messageData = {
        ...req.body,
        webinarId,
        userId: req.isAuthenticated() ? req.user!.id : null
      };
      
      const message = await webinarStorage.createWebinarChatMessage(messageData);
      
      // Broadcast message to all connected clients
      broadcastToWebinar(webinarId, {
        type: 'chat-message',
        message
      });
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error posting chat message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get questions for a webinar (owner or admin only)
  app.get('/api/webinars/:id/questions', isWebinarOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      const questions = await webinarStorage.getWebinarQuestions(webinarId);
      
      res.json(questions);
    } catch (error) {
      console.error("Error getting webinar questions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Add an offer to a webinar (owner or admin only)
  app.post('/api/webinars/:id/offers', isWebinarOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      
      // Validate offer data
      const offerSchema = z.object({
        title: z.string().min(1),
        description: z.string(),
        price: z.number().optional(),
        buttonText: z.string().min(1),
        buttonUrl: z.string().min(1),
        imageUrl: z.string().optional(),
        timing: z.number().optional(),
        durationSeconds: z.number().optional(),
        active: z.boolean().default(true)
      });
      
      const offerData = offerSchema.parse(req.body);
      
      const updatedWebinar = await webinarStorage.addWebinarOffer(webinarId, {
        ...offerData,
        id: '',  // Will be generated in the storage layer
        created: ''  // Will be set in the storage layer
      });
      
      if (!updatedWebinar) {
        return res.status(404).json({ error: "Webinar not found" });
      }
      
      res.status(201).json(updatedWebinar.offers);
    } catch (error) {
      console.error("Error adding webinar offer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid offer data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Update an offer (owner or admin only)
  app.put('/api/webinars/:id/offers/:offerId', isWebinarOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      const offerId = req.params.offerId;
      
      const offerSchema = z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        price: z.number().optional(),
        buttonText: z.string().min(1).optional(),
        buttonUrl: z.string().min(1).optional(),
        imageUrl: z.string().optional(),
        timing: z.number().optional(),
        durationSeconds: z.number().optional(),
        active: z.boolean().optional()
      });
      
      const offerData = offerSchema.parse(req.body);
      
      const updatedWebinar = await webinarStorage.updateWebinarOffer(webinarId, offerId, offerData);
      
      if (!updatedWebinar) {
        return res.status(404).json({ error: "Webinar or offer not found" });
      }
      
      res.json(updatedWebinar.offers);
    } catch (error) {
      console.error("Error updating webinar offer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid offer data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Delete an offer (owner or admin only)
  app.delete('/api/webinars/:id/offers/:offerId', isWebinarOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      const offerId = req.params.offerId;
      
      const updatedWebinar = await webinarStorage.removeWebinarOffer(webinarId, offerId);
      
      if (!updatedWebinar) {
        return res.status(404).json({ error: "Webinar or offer not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting webinar offer:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Add a resource to a webinar (owner or admin only)
  app.post('/api/webinars/:id/resources', isWebinarOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      
      // Validate resource data
      const resourceSchema = z.object({
        name: z.string().min(1),
        url: z.string().min(1),
        fileKey: z.string().optional(),
        type: z.string().min(1),
        order: z.number().default(0)
      });
      
      const resourceData = resourceSchema.parse(req.body);
      
      const updatedWebinar = await webinarStorage.addWebinarResource(webinarId, {
        ...resourceData,
        createdAt: ''  // Will be set in the storage layer
      });
      
      if (!updatedWebinar) {
        return res.status(404).json({ error: "Webinar not found" });
      }
      
      res.status(201).json(updatedWebinar.resources);
    } catch (error) {
      console.error("Error adding webinar resource:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid resource data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Remove a resource (owner or admin only)
  app.delete('/api/webinars/:id/resources/:index', isWebinarOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      const resourceIndex = parseInt(req.params.index);
      
      if (isNaN(resourceIndex)) {
        return res.status(400).json({ error: "Invalid resource index" });
      }
      
      const updatedWebinar = await webinarStorage.removeWebinarResource(webinarId, resourceIndex);
      
      if (!updatedWebinar) {
        return res.status(404).json({ error: "Webinar or resource not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error removing webinar resource:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Update layout settings (owner or admin only)
  app.put('/api/webinars/:id/layout', isWebinarOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
      const webinarId = parseInt(req.params.id);
      
      // Validate layout settings
      const layoutSchema = z.object({
        type: z.string().min(1),
        cameraSize: z.string().min(1),
        cameraPosition: z.string().min(1),
        hideAttendees: z.boolean()
      });
      
      const layoutData = layoutSchema.parse(req.body);
      
      const updatedWebinar = await webinarStorage.updateWebinarLayout(webinarId, layoutData);
      
      if (!updatedWebinar) {
        return res.status(404).json({ error: "Webinar not found" });
      }
      
      // Broadcast layout change to all participants
      broadcastToWebinar(webinarId, {
        type: 'layout-changed',
        layout: layoutData,
        timestamp: Date.now()
      });
      
      res.json(updatedWebinar);
    } catch (error) {
      console.error("Error updating webinar layout:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid layout data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });
}

// Helper function to detect device type from user agent
function detectDeviceType(userAgent: string): string {
  if (!userAgent) return 'unknown';
  
  const ua = userAgent.toLowerCase();
  
  if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    if (/ipad/i.test(ua) || (/tablet/i.test(ua) && !/mobile/i.test(ua)) || /android(?!.*mobile)/i.test(ua)) {
      return 'tablet';
    }
    return 'mobile';
  }
  
  return 'desktop';
}