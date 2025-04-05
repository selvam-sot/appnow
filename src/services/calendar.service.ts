import { google } from 'googleapis';
import logger from '../config/logger';

// Google Calendar API configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Function to add an event to Google Calendar
export const addEventToCalendar = async (
  accessToken: string,
  summary: string,
  description: string,
  startDateTime: string,
  endDateTime: string,
  attendeeEmails: string[] = []
): Promise<any> => {
  try {
    // Set the access token
    oauth2Client.setCredentials({ access_token: accessToken });
    
    // Initialize the Calendar API
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Create the event object
    const event = {
      summary,
      description,
      start: {
        dateTime: startDateTime,
        timeZone: 'UTC',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'UTC',
      },
      attendees: attendeeEmails.map(email => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 }, // 30 minutes before
        ],
      },
    };
    
    // Insert the event into the user's calendar
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });
    
    logger.info(`Event created: ${response.data.htmlLink}`);
    return response.data;
  } catch (error) {
    logger.error('Error adding event to Google Calendar:', error);
    throw new Error('Failed to add event to calendar');
  }
};

// Function to get user's calendar events
export const getCalendarEvents = async (
  accessToken: string,
  timeMin: string,
  timeMax: string,
  maxResults = 10
): Promise<any> => {
  try {
    // Set the access token
    oauth2Client.setCredentials({ access_token: accessToken });
    
    // Initialize the Calendar API
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // List events
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    return response.data.items;
  } catch (error) {
    logger.error('Error fetching calendar events:', error);
    throw new Error('Failed to fetch calendar events');
  }
};

// Function to update an existing calendar event
export const updateCalendarEvent = async (
  accessToken: string,
  eventId: string,
  summary?: string,
  description?: string,
  startDateTime?: string,
  endDateTime?: string
): Promise<any> => {
  try {
    // Set the access token
    oauth2Client.setCredentials({ access_token: accessToken });
    
    // Initialize the Calendar API
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // First, get the existing event
    const event = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    });
    
    // Create update object with only the fields that are provided
    const updateObject: any = {};
    
    if (summary) updateObject.summary = summary;
    if (description) updateObject.description = description;
    if (startDateTime) {
      updateObject.start = {
        dateTime: startDateTime,
        timeZone: 'UTC',
      };
    }
    if (endDateTime) {
      updateObject.end = {
        dateTime: endDateTime,
        timeZone: 'UTC',
      };
    }
    
    // Update the event
    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: {
        ...event.data,
        ...updateObject,
      },
    });
    
    logger.info(`Event updated: ${response.data.htmlLink}`);
    return response.data;
  } catch (error) {
    logger.error('Error updating calendar event:', error);
    throw new Error('Failed to update calendar event');
  }
};

// Function to delete a calendar event
export const deleteCalendarEvent = async (
  accessToken: string,
  eventId: string
): Promise<void> => {
  try {
    // Set the access token
    oauth2Client.setCredentials({ access_token: accessToken });
    
    // Initialize the Calendar API
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Delete the event
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });
    
    logger.info(`Event deleted: ${eventId}`);
  } catch (error) {
    logger.error('Error deleting calendar event:', error);
    throw new Error('Failed to delete calendar event');
  }
};