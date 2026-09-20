/**
 * Specialized AI Event Assistant for EventSphere.
 * Employs intent classification and strictly controlled tool invocation.
 * Enforces architectural boundary: The assistant NEVER accesses MongoDB directly.
 * All data retrieval is routed through domain service methods.
 */

const { redisClient } = require('../config/redis');
const eventService = require('./EventService');
const bookingService = require('./BookingService');
const recommendationService = require('./RecommendationService');
const { venueRepository, categoryRepository } = require('../repositories');
const config = require('../config/env');
const logger = require('../config/logger');

class AiAssistantService {
  constructor() {
    // Controlled tools definitions
    this.tools = {
      searchEvents: this.toolSearchEvents.bind(this),
      getEventDetails: this.toolGetEventDetails.bind(this),
      getUserBookings: this.toolGetUserBookings.bind(this),
      getVenueDetails: this.toolGetVenueDetails.bind(this),
      getCancellationPolicy: this.toolGetCancellationPolicy.bind(this),
      getRecommendedEvents: this.toolGetRecommendedEvents.bind(this),
    };
  }

  /**
   * Main entry point for user interaction with AI Assistant.
   * @param {string} userId
   * @param {string} message
   * @param {string} conversationId
   */
  async processQuery(userId, message, conversationId = 'default') {
    logger.info('AI Assistant processing query', { userId, conversationId, messageLength: message.length });

    // 1. Retrieve conversation context from Redis
    const contextKey = `chat:${userId}:${conversationId}`;
    let history = [];
    try {
      const stored = await redisClient.get(contextKey);
      if (stored) {
        history = JSON.parse(stored);
      }
    } catch (err) {
      logger.warn('Failed to load chat history from Redis', { error: err.message });
    }

    // 2. Classify user intent and map to controlled tool
    const { toolName, params, intentDescription } = await this.detectIntent(message, userId, history);

    // 3. Execute tool safely via domain service
    let toolResult = null;
    let toolError = null;

    try {
      if (toolName && this.tools[toolName]) {
        logger.info(`AI executing controlled tool: ${toolName}`, { params });
        toolResult = await this.tools[toolName](params);
      } else {
        // Default to search
        toolResult = await this.tools.searchEvents({ search: message });
      }
    } catch (err) {
      toolError = err.message;
      logger.error(`AI tool execution error (${toolName})`, { error: err.message });
    }

    // 4. Synthesize friendly assistant reply
    const responseText = this.formatResponse(message, toolName, toolResult, toolError, intentDescription);

    // 5. Update Redis conversation history (TTL 24 hours)
    history.push({ role: 'user', content: message, timestamp: Date.now() });
    history.push({
      role: 'assistant',
      content: responseText,
      toolUsed: toolName,
      toolData: toolResult,
      timestamp: Date.now(),
    });

    // Keep last 10 messages for context efficiency
    if (history.length > 10) {
      history = history.slice(-10);
    }

    try {
      await redisClient.set(contextKey, JSON.stringify(history), 'EX', 86400);
    } catch (err) {
      logger.warn('Failed to save chat context in Redis', { error: err.message });
    }

    return {
      conversationId,
      reply: responseText,
      toolUsed: toolName,
      data: toolResult,
    };
  }

  /**
   * Rule-based and semantic intent detector.
   * Extracts location, price constraints, categories, and booking queries.
   */
  async detectIntent(query, userId, history = []) {
    const lower = query.toLowerCase();

    // Intent 1: User's own bookings or ticket status
    if (lower.includes('my booking') || lower.includes('my ticket') || lower.includes('what did i book') || lower.includes('booked events')) {
      return {
        toolName: 'getUserBookings',
        params: { userId },
        intentDescription: 'Retrieving your active and past event bookings.',
      };
    }

    // Intent 2: Recommendations / "near me" / "similar"
    if (lower.includes('recommend') || lower.includes('suggest') || lower.includes('near me') || lower.includes('for me')) {
      return {
        toolName: 'getRecommendedEvents',
        params: { userId },
        intentDescription: 'Finding personalized events matching your taste and location.',
      };
    }

    // Intent 3: Cancellation policy
    if (lower.includes('cancellation') || lower.includes('refund policy') || lower.includes('cancel policy')) {
      return {
        toolName: 'getCancellationPolicy',
        params: { query },
        intentDescription: 'Checking event cancellation and refund guidelines.',
      };
    }

    // Intent 4: Search with location, category, and price extraction
    const cities = ['mumbai', 'delhi', 'bengaluru', 'bangalore', 'pune', 'hyderabad', 'chennai', 'kolkata', 'bhubaneswar', 'ahmedabad', 'jaipur', 'goa'];
    let matchedCity = null;
    for (const city of cities) {
      if (lower.includes(city)) {
        matchedCity = city === 'bangalore' ? 'Bengaluru' : city.charAt(0).toUpperCase() + city.slice(1);
        break;
      }
    }

    // Price extraction: e.g. "under 2000", "< 1500", "below 500"
    let maxPrice = null;
    const priceMatch = lower.match(/(?:under|below|less than|<|up to|within)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
    if (priceMatch) {
      maxPrice = parseInt(priceMatch[1], 10);
    }

    // Category extraction
    let category = null;
    const categories = ['music', 'comedy', 'standup', 'tech', 'sports', 'theater', 'conference', 'workshop'];
    for (const cat of categories) {
      if (lower.includes(cat)) {
        category = cat;
        break;
      }
    }

    // Date extraction: "this weekend", "tomorrow"
    let startDate = null;
    let endDate = null;
    const now = new Date();
    if (lower.includes('weekend') || lower.includes('this weekend')) {
      const day = now.getDay();
      const diffToSaturday = 6 - day;
      const saturday = new Date(now);
      saturday.setDate(now.getDate() + diffToSaturday);
      saturday.setHours(0, 0, 0, 0);

      const sunday = new Date(saturday);
      sunday.setDate(saturday.getDate() + 1);
      sunday.setHours(23, 59, 59, 999);

      startDate = saturday.toISOString();
      endDate = sunday.toISOString();
    } else if (lower.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      startDate = tomorrow.toISOString();
    }

    return {
      toolName: 'searchEvents',
      params: {
        city: matchedCity,
        search: query.replace(/(?:find|show|events|in|under|below|this weekend|tomorrow|tickets)/gi, '').trim(),
        maxPrice,
        category,
        startDate,
        endDate,
      },
      intentDescription: `Searching events ${matchedCity ? `in ${matchedCity}` : ''} ${maxPrice ? `under ₹${maxPrice}` : ''}`,
    };
  }

  // --- Controlled Tools (Calls Domain Services, NOT MongoDB directly) ---

  async toolSearchEvents(params) {
    const filters = {
      status: 'PUBLISHED',
      limit: 6,
    };
    if (params.city) filters.city = params.city;
    if (params.maxPrice) filters.maxPrice = params.maxPrice;
    if (params.startDate) filters.startDate = params.startDate;
    if (params.endDate) filters.endDate = params.endDate;
    if (params.search && params.search.length > 2) filters.search = params.search;

    const result = await eventService.getEvents(filters);
    return result.items || [];
  }

  async toolGetEventDetails({ eventId, slug }) {
    if (slug) return eventService.getEventBySlug(slug);
    if (eventId) return eventService.getEventById(eventId);
    return null;
  }

  async toolGetUserBookings({ userId }) {
    if (!userId) return [];
    const result = await bookingService.getUserBookings(userId, { page: 1, limit: 5 });
    return result.items || [];
  }

  async toolGetVenueDetails({ venueId }) {
    return venueRepository.findById(venueId);
  }

  async toolGetCancellationPolicy({ query, eventId }) {
    if (eventId) {
      const event = await eventService.getEventById(eventId);
      return { eventTitle: event.title, policy: event.cancellationPolicy };
    }
    return {
      generalPolicy: 'Standard EventSphere Policy: Tickets can be cancelled up to 24 hours prior to event start for a refund. Individual organizers may define custom refund terms.',
    };
  }

  async toolGetRecommendedEvents({ userId }) {
    return recommendationService.getRecommendations(userId, 5);
  }

  /**
   * Synthesize natural language reply based on tool execution data.
   */
  formatResponse(query, toolName, data, error, intentDescription) {
    if (error) {
      return `I encountered an issue while searching: ${error}. Please try rephrasing your question or browse our Events catalog.`;
    }

    if (toolName === 'getUserBookings') {
      if (!data || data.length === 0) {
        return "You don't have any confirmed bookings yet. Browse our trending events to book your next experience!";
      }
      const list = data.map((b) => `• **${b.event?.title || 'Event'}** (#${b.bookingNumber}) — Status: **${b.status}** on ${new Date(b.event?.startDate).toLocaleDateString()}`).join('\n');
      return `Here are your recent bookings:\n\n${list}\n\nYou can view full QR entry tickets in **My Bookings**.`;
    }

    if (toolName === 'getCancellationPolicy') {
      return data.policy
        ? `**Cancellation Policy for ${data.eventTitle}:**\n\n${data.policy}`
        : `**EventSphere Cancellation Terms:**\n\n${data.generalPolicy}`;
    }

    if (toolName === 'getRecommendedEvents') {
      if (!data || data.length === 0) {
        return "We don't have personalized recommendations for you yet. Check out our trending events on the home page!";
      }
      const list = data.map((e) => `• **${e.title}** (${e.venue?.city || 'City'}) — Starting ₹${e.pricingTiers?.[0]?.price || 'N/A'}`).join('\n');
      return `Here are top recommendations tailored for you:\n\n${list}\n\nWould you like to select seats for any of these?`;
    }

    // Default: search results
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return "I couldn't find any upcoming events matching those exact filters. Would you like to check events in nearby cities or browse all upcoming events?";
      }

      const list = data.map((e) => {
        const price = e.pricingTiers && e.pricingTiers[0] ? `₹${e.pricingTiers[0].price}` : 'Check details';
        const dateStr = new Date(e.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        return `• **${e.title}** — ${e.venue?.name || 'Venue'}, ${e.venue?.city || ''} (${dateStr}) | Starts at ${price}`;
      }).join('\n');

      return `I found ${data.length} event(s) matching your request:\n\n${list}\n\nClick on any event on screen to view the seat map and book tickets!`;
    }

    return "I am EventSphere AI. How can I help you discover live experiences, verify bookings, or pick the best seats?";
  }
}

module.exports = new AiAssistantService();
