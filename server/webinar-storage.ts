import { 
  Webinar, InsertWebinar,
  WebinarAttendee, InsertWebinarAttendee,
  WebinarChatMessage, InsertWebinarChatMessage,
  webinars, webinarAttendees, webinarChatMessages,
  WebinarResourceItem, WebinarOfferItem, WebinarLayoutSetting
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count, isNull, asc, gt, lt, not } from "drizzle-orm";
import { storage } from "./storage";
import { v4 as uuidv4 } from 'uuid';
import { generateRtcToken, generateUniqueChannelName } from './agora';

export interface IWebinarStorage {
  // Webinar operations
  getWebinar(id: number): Promise<Webinar | undefined>;
  getWebinarByUniqueId(uniqueId: string): Promise<Webinar | undefined>;
  getWebinarsByHost(hostId: number): Promise<Webinar[]>;
  getUpcomingWebinars(): Promise<Webinar[]>;
  getActiveWebinars(): Promise<Webinar[]>;
  getPastWebinars(): Promise<Webinar[]>;
  createWebinar(webinar: InsertWebinar): Promise<Webinar>;
  updateWebinar(id: number, webinar: Partial<InsertWebinar>): Promise<Webinar | undefined>;
  updateWebinarStatus(id: number, status: string): Promise<Webinar | undefined>;
  deleteWebinar(id: number): Promise<boolean>;
  
  // Webinar resources and offers
  addWebinarResource(webinarId: number, resource: WebinarResourceItem): Promise<Webinar | undefined>;
  removeWebinarResource(webinarId: number, resourceIndex: number): Promise<Webinar | undefined>;
  addWebinarOffer(webinarId: number, offer: WebinarOfferItem): Promise<Webinar | undefined>;
  updateWebinarOffer(webinarId: number, offerId: string, offerUpdates: Partial<WebinarOfferItem>): Promise<Webinar | undefined>;
  removeWebinarOffer(webinarId: number, offerId: string): Promise<Webinar | undefined>;
  
  // Webinar layout settings
  updateWebinarLayout(webinarId: number, layoutSettings: WebinarLayoutSetting): Promise<Webinar | undefined>;
  
  // Webinar room management
  startWebinar(webinarId: number): Promise<Webinar | undefined>;
  endWebinar(webinarId: number): Promise<Webinar | undefined>;
  generateWebinarRoomTokens(webinarId: number): Promise<{adminToken: string, publicId: string}>;
  
  // Attendee operations
  getWebinarAttendee(id: number): Promise<WebinarAttendee | undefined>;
  getWebinarAttendeeByUniqueId(attendeeId: string): Promise<WebinarAttendee | undefined>;
  getAttendeesByWebinar(webinarId: number): Promise<WebinarAttendee[]>;
  getCurrentAttendeeCount(webinarId: number): Promise<number>;
  createWebinarAttendee(attendee: InsertWebinarAttendee): Promise<WebinarAttendee>;
  updateWebinarAttendee(id: number, updates: Partial<WebinarAttendee>): Promise<WebinarAttendee | undefined>;
  updateAttendeeLeaveTime(attendeeId: string): Promise<WebinarAttendee | undefined>;
  deleteWebinarAttendee(id: number): Promise<boolean>;
  
  // Chat operations
  getWebinarChatMessages(webinarId: number, limit?: number, beforeId?: number): Promise<WebinarChatMessage[]>;
  getWebinarQuestions(webinarId: number): Promise<WebinarChatMessage[]>;
  createWebinarChatMessage(message: InsertWebinarChatMessage): Promise<WebinarChatMessage>;
  markQuestionAsAnswered(messageId: number): Promise<WebinarChatMessage | undefined>;
  highlightChatMessage(messageId: number, highlighted: boolean): Promise<WebinarChatMessage | undefined>;
  deleteWebinarChatMessage(id: number): Promise<boolean>;
}

export class DatabaseWebinarStorage implements IWebinarStorage {
  // Webinar operations
  async getWebinar(id: number): Promise<Webinar | undefined> {
    try {
      const [webinar] = await db.select().from(webinars).where(eq(webinars.id, id));
      return webinar;
    } catch (error) {
      console.error("Error getting webinar:", error);
      return undefined;
    }
  }

  async getWebinarByUniqueId(uniqueId: string): Promise<Webinar | undefined> {
    try {
      // Since uniqueId doesn't exist in the database, we're falling back to using the id
      // This is just a temporary solution until the database schema is updated
      const id = parseInt(uniqueId);
      if (isNaN(id)) {
        console.warn("Invalid unique ID format:", uniqueId);
        return undefined;
      }
      
      const [webinar] = await db.select().from(webinars).where(eq(webinars.id, id));
      return webinar;
    } catch (error) {
      console.error("Error getting webinar by unique ID:", error);
      return undefined;
    }
  }

  async getWebinarsByHost(hostId: number): Promise<Webinar[]> {
    try {
      return await db.select().from(webinars).where(eq(webinars.hostId, hostId)).orderBy(desc(webinars.createdAt));
    } catch (error) {
      console.error("Error getting webinars by host:", error);
      return [];
    }
  }

  async getUpcomingWebinars(): Promise<Webinar[]> {
    try {
      const now = new Date();
      return await db.select()
        .from(webinars)
        .where(and(
          eq(webinars.status, 'scheduled'),
          gt(webinars.scheduledStartTime, now)
        ))
        .orderBy(asc(webinars.scheduledStartTime));
    } catch (error) {
      console.error("Error getting upcoming webinars:", error);
      return [];
    }
  }

  async getActiveWebinars(): Promise<Webinar[]> {
    try {
      return await db.select()
        .from(webinars)
        .where(eq(webinars.status, 'live'))
        .orderBy(asc(webinars.createdAt));
    } catch (error) {
      console.error("Error getting active webinars:", error);
      return [];
    }
  }

  async getPastWebinars(): Promise<Webinar[]> {
    try {
      const now = new Date();
      return await db.select()
        .from(webinars)
        .where(
          and(
            not(eq(webinars.status, 'draft')),
            // Use separate 'and' instead of 'or' since 'or' isn't imported
            // This achieves the same result: either status is 'ended'
            // or the scheduled end time is in the past
            eq(webinars.status, 'ended')
          )
        )
        .orderBy(desc(webinars.scheduledStartTime));
      
      // Also get webinars that have passed their scheduled end time
      const pastWebinars = await db.select()
        .from(webinars)
        .where(
          and(
            not(eq(webinars.status, 'draft')),
            not(eq(webinars.status, 'ended')),
            lt(webinars.scheduledEndTime, now)
          )
        )
        .orderBy(desc(webinars.scheduledStartTime));
      
      // Combine the results
      return [...pastWebinars];
    } catch (error) {
      console.error("Error getting past webinars:", error);
      return [];
    }
  }

  async createWebinar(webinar: InsertWebinar): Promise<Webinar> {
    try {
      // Generate unique channel IDs for admin and public rooms
      const adminRoomId = generateUniqueChannelName('admin');
      const publicRoomId = generateUniqueChannelName('public');

      // Get settings from webinar input
      const settings = webinar.settings || {};

      // Ensure timezone is in settings
      if (settings && typeof settings === 'object') {
        if (!settings.timezone) {
          settings.timezone = 'Asia/Tbilisi';
        }
      }

      // Create the webinar with the correct fields based on schema.ts
      const [createdWebinar] = await db.insert(webinars)
        .values({
          title: webinar.title,
          description: webinar.description,
          instructorName: webinar.instructorName,
          scheduledStartTime: webinar.scheduledStartTime,
          scheduledEndTime: webinar.scheduledEndTime,
          status: webinar.status || 'draft',
          maxParticipants: webinar.maxParticipants,
          settings: webinar.settings,
          createdBy: webinar.createdBy,
          thumbnailUrl: webinar.thumbnailUrl
        })
        .returning();

      return createdWebinar;
    } catch (error) {
      console.error("Error creating webinar:", error);
      throw error;
    }
  }

  async updateWebinar(id: number, webinar: Partial<InsertWebinar>): Promise<Webinar | undefined> {
    try {
      const [updatedWebinar] = await db.update(webinars)
        .set({
          ...webinar,
          updatedAt: new Date()
        })
        .where(eq(webinars.id, id))
        .returning();
      
      return updatedWebinar;
    } catch (error) {
      console.error("Error updating webinar:", error);
      return undefined;
    }
  }

  async updateWebinarStatus(id: number, status: string): Promise<Webinar | undefined> {
    try {
      const [updatedWebinar] = await db.update(webinars)
        .set({
          status,
          updatedAt: new Date()
        })
        .where(eq(webinars.id, id))
        .returning();
      
      return updatedWebinar;
    } catch (error) {
      console.error("Error updating webinar status:", error);
      return undefined;
    }
  }

  async deleteWebinar(id: number): Promise<boolean> {
    try {
      const result = await db.delete(webinars).where(eq(webinars.id, id));
      return result.count > 0;
    } catch (error) {
      console.error("Error deleting webinar:", error);
      return false;
    }
  }
  
  // Webinar resources and offers
  async addWebinarResource(webinarId: number, resource: WebinarResourceItem): Promise<Webinar | undefined> {
    try {
      const webinar = await this.getWebinar(webinarId);
      if (!webinar) return undefined;
      
      const resources = [...(webinar.resources || []), {
        ...resource,
        createdAt: new Date().toISOString()
      }];
      
      return await this.updateWebinar(webinarId, { resources });
    } catch (error) {
      console.error("Error adding webinar resource:", error);
      return undefined;
    }
  }
  
  async removeWebinarResource(webinarId: number, resourceIndex: number): Promise<Webinar | undefined> {
    try {
      const webinar = await this.getWebinar(webinarId);
      if (!webinar || !webinar.resources) return undefined;
      
      const resources = [...webinar.resources];
      if (resourceIndex >= 0 && resourceIndex < resources.length) {
        resources.splice(resourceIndex, 1);
        return await this.updateWebinar(webinarId, { resources });
      }
      
      return webinar;
    } catch (error) {
      console.error("Error removing webinar resource:", error);
      return undefined;
    }
  }
  
  async addWebinarOffer(webinarId: number, offer: WebinarOfferItem): Promise<Webinar | undefined> {
    try {
      const webinar = await this.getWebinar(webinarId);
      if (!webinar) return undefined;
      
      const offers = [...(webinar.offers || []), {
        ...offer,
        id: uuidv4(),
        created: new Date().toISOString()
      }];
      
      return await this.updateWebinar(webinarId, { offers });
    } catch (error) {
      console.error("Error adding webinar offer:", error);
      return undefined;
    }
  }
  
  async updateWebinarOffer(webinarId: number, offerId: string, offerUpdates: Partial<WebinarOfferItem>): Promise<Webinar | undefined> {
    try {
      const webinar = await this.getWebinar(webinarId);
      if (!webinar || !webinar.offers) return undefined;
      
      const offers = webinar.offers.map(offer => 
        offer.id === offerId ? { ...offer, ...offerUpdates } : offer
      );
      
      return await this.updateWebinar(webinarId, { offers });
    } catch (error) {
      console.error("Error updating webinar offer:", error);
      return undefined;
    }
  }
  
  async removeWebinarOffer(webinarId: number, offerId: string): Promise<Webinar | undefined> {
    try {
      const webinar = await this.getWebinar(webinarId);
      if (!webinar || !webinar.offers) return undefined;
      
      const offers = webinar.offers.filter(offer => offer.id !== offerId);
      
      return await this.updateWebinar(webinarId, { offers });
    } catch (error) {
      console.error("Error removing webinar offer:", error);
      return undefined;
    }
  }
  
  // Webinar layout settings
  async updateWebinarLayout(webinarId: number, layoutSettings: WebinarLayoutSetting): Promise<Webinar | undefined> {
    try {
      return await this.updateWebinar(webinarId, { layoutSettings });
    } catch (error) {
      console.error("Error updating webinar layout:", error);
      return undefined;
    }
  }
  
  // Webinar room management
  async startWebinar(webinarId: number): Promise<Webinar | undefined> {
    try {
      const webinar = await this.getWebinar(webinarId);
      if (!webinar) return undefined;
      
      // Generate room tokens if needed
      if (!webinar.adminRoomToken) {
        const { adminToken } = await this.generateWebinarRoomTokens(webinarId);
      }
      
      const [updatedWebinar] = await db.update(webinars)
        .set({
          status: 'live',
          actualStartTime: new Date(),
          updatedAt: new Date()
        })
        .where(eq(webinars.id, webinarId))
        .returning();
      
      return updatedWebinar;
    } catch (error) {
      console.error("Error starting webinar:", error);
      return undefined;
    }
  }
  
  async endWebinar(webinarId: number): Promise<Webinar | undefined> {
    try {
      const [updatedWebinar] = await db.update(webinars)
        .set({
          status: 'ended',
          actualEndTime: new Date(),
          updatedAt: new Date()
        })
        .where(eq(webinars.id, webinarId))
        .returning();
      
      // Also update all attendees' leave time
      await db.update(webinarAttendees)
        .set({
          leaveTime: new Date(),
          inRoom: false
        })
        .where(and(
          eq(webinarAttendees.webinarId, webinarId),
          eq(webinarAttendees.inRoom, true)
        ));
      
      return updatedWebinar;
    } catch (error) {
      console.error("Error ending webinar:", error);
      return undefined;
    }
  }
  
  async generateWebinarRoomTokens(webinarId: number): Promise<{adminToken: string, publicId: string}> {
    try {
      const webinar = await this.getWebinar(webinarId);
      if (!webinar) {
        throw new Error("Webinar not found");
      }
      
      // Generate admin token with publisher privileges
      const adminToken = generateRtcToken(
        webinar.adminRoomId,
        0, // UID 0 means use the account for authentication
        'publisher',
        24 * 60 * 60, // 24 hours expiration
        `host_${webinar.hostId}`
      );
      
      // Update webinar with the admin token
      const [updatedWebinar] = await db.update(webinars)
        .set({
          adminRoomToken: adminToken,
          updatedAt: new Date()
        })
        .where(eq(webinars.id, webinarId))
        .returning();
      
      return {
        adminToken,
        publicId: webinar.publicRoomId
      };
    } catch (error) {
      console.error("Error generating webinar room tokens:", error);
      throw error;
    }
  }
  
  // Attendee operations
  async getWebinarAttendee(id: number): Promise<WebinarAttendee | undefined> {
    try {
      const [attendee] = await db.select().from(webinarAttendees).where(eq(webinarAttendees.id, id));
      return attendee;
    } catch (error) {
      console.error("Error getting webinar attendee:", error);
      return undefined;
    }
  }
  
  async getWebinarAttendeeByUniqueId(attendeeId: string): Promise<WebinarAttendee | undefined> {
    try {
      const [attendee] = await db.select().from(webinarAttendees).where(eq(webinarAttendees.attendeeId, attendeeId));
      return attendee;
    } catch (error) {
      console.error("Error getting webinar attendee by unique ID:", error);
      return undefined;
    }
  }
  
  async getAttendeesByWebinar(webinarId: number): Promise<WebinarAttendee[]> {
    try {
      return await db.select()
        .from(webinarAttendees)
        .where(eq(webinarAttendees.webinarId, webinarId))
        .orderBy(desc(webinarAttendees.joinTime));
    } catch (error) {
      console.error("Error getting attendees by webinar:", error);
      return [];
    }
  }
  
  async getCurrentAttendeeCount(webinarId: number): Promise<number> {
    try {
      const result = await db.select({ count: count() })
        .from(webinarAttendees)
        .where(and(
          eq(webinarAttendees.webinarId, webinarId),
          eq(webinarAttendees.inRoom, true)
        ));
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error getting current attendee count:", error);
      return 0;
    }
  }
  
  async createWebinarAttendee(attendee: InsertWebinarAttendee): Promise<WebinarAttendee> {
    try {
      const [createdAttendee] = await db.insert(webinarAttendees)
        .values(attendee)
        .returning();
      
      return createdAttendee;
    } catch (error) {
      console.error("Error creating webinar attendee:", error);
      throw error;
    }
  }
  
  async updateWebinarAttendee(id: number, updates: Partial<WebinarAttendee>): Promise<WebinarAttendee | undefined> {
    try {
      const [updatedAttendee] = await db.update(webinarAttendees)
        .set(updates)
        .where(eq(webinarAttendees.id, id))
        .returning();
      
      return updatedAttendee;
    } catch (error) {
      console.error("Error updating webinar attendee:", error);
      return undefined;
    }
  }
  
  async updateAttendeeLeaveTime(attendeeId: string): Promise<WebinarAttendee | undefined> {
    try {
      const attendee = await this.getWebinarAttendeeByUniqueId(attendeeId);
      if (!attendee) return undefined;
      
      const leaveTime = new Date();
      const joinTime = new Date(attendee.joinTime);
      
      // Calculate time watched in seconds
      const timeWatchedSeconds = Math.floor((leaveTime.getTime() - joinTime.getTime()) / 1000);
      const totalTimeWatched = attendee.timeWatched + timeWatchedSeconds;
      
      const [updatedAttendee] = await db.update(webinarAttendees)
        .set({
          leaveTime,
          inRoom: false,
          timeWatched: totalTimeWatched
        })
        .where(eq(webinarAttendees.attendeeId, attendeeId))
        .returning();
      
      return updatedAttendee;
    } catch (error) {
      console.error("Error updating attendee leave time:", error);
      return undefined;
    }
  }
  
  async deleteWebinarAttendee(id: number): Promise<boolean> {
    try {
      const result = await db.delete(webinarAttendees).where(eq(webinarAttendees.id, id));
      return result.count > 0;
    } catch (error) {
      console.error("Error deleting webinar attendee:", error);
      return false;
    }
  }
  
  // Chat operations
  async getWebinarChatMessages(webinarId: number, limit: number = 100, beforeId?: number): Promise<WebinarChatMessage[]> {
    try {
      let query = db.select()
        .from(webinarChatMessages)
        .where(eq(webinarChatMessages.webinarId, webinarId))
        .orderBy(desc(webinarChatMessages.createdAt))
        .limit(limit);
      
      if (beforeId) {
        query = query.where(lt(webinarChatMessages.id, beforeId));
      }
      
      return await query;
    } catch (error) {
      console.error("Error getting webinar chat messages:", error);
      return [];
    }
  }
  
  async getWebinarQuestions(webinarId: number): Promise<WebinarChatMessage[]> {
    try {
      return await db.select()
        .from(webinarChatMessages)
        .where(and(
          eq(webinarChatMessages.webinarId, webinarId),
          eq(webinarChatMessages.isQuestion, true)
        ))
        .orderBy(desc(webinarChatMessages.createdAt));
    } catch (error) {
      console.error("Error getting webinar questions:", error);
      return [];
    }
  }
  
  async createWebinarChatMessage(message: InsertWebinarChatMessage): Promise<WebinarChatMessage> {
    try {
      const [createdMessage] = await db.insert(webinarChatMessages)
        .values(message)
        .returning();
      
      return createdMessage;
    } catch (error) {
      console.error("Error creating webinar chat message:", error);
      throw error;
    }
  }
  
  async markQuestionAsAnswered(messageId: number): Promise<WebinarChatMessage | undefined> {
    try {
      const [updatedMessage] = await db.update(webinarChatMessages)
        .set({
          isAnswered: true
        })
        .where(and(
          eq(webinarChatMessages.id, messageId),
          eq(webinarChatMessages.isQuestion, true)
        ))
        .returning();
      
      return updatedMessage;
    } catch (error) {
      console.error("Error marking question as answered:", error);
      return undefined;
    }
  }
  
  async highlightChatMessage(messageId: number, highlighted: boolean): Promise<WebinarChatMessage | undefined> {
    try {
      const [updatedMessage] = await db.update(webinarChatMessages)
        .set({
          isHighlighted: highlighted
        })
        .where(eq(webinarChatMessages.id, messageId))
        .returning();
      
      return updatedMessage;
    } catch (error) {
      console.error("Error highlighting chat message:", error);
      return undefined;
    }
  }
  
  async deleteWebinarChatMessage(id: number): Promise<boolean> {
    try {
      const result = await db.delete(webinarChatMessages).where(eq(webinarChatMessages.id, id));
      return result.count > 0;
    } catch (error) {
      console.error("Error deleting webinar chat message:", error);
      return false;
    }
  }
}

// Initialize and export
export const webinarStorage = new DatabaseWebinarStorage();