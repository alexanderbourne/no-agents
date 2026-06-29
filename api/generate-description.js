// api/generate-description.js
// Generates a professional property listing description using Claude API.
// Called from the seller dashboard after listing is created.
//
// POST /api/generate-description
// Body: { address, beds, baths, cars, type, floor, suburb, postcode, price }
// Returns: { description }
//
// Required env var: ANTHROPIC_API_KEY

import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Description generation not configured' });
  }

  const { address, beds, baths, cars, type, floor, suburb, postcode, price } = req.body || {};

  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }

  const prompt = `Write a professional Australian real estate listing description for this property. Keep it to 3-4 sentences, warm but factual. Do not invent features — only describe what can be reasonably inferred from the details provided. Use the style typical of Domain.com.au listings in Queensland.

Property details:
- Address: ${address}
- Type: ${type || 'Property'}
- Bedrooms: ${beds || 'N/A'}
- Bathrooms: ${baths || 'N/A'}
- Car spaces: ${cars || 'N/A'}
${floor ? `- Floor level: ${floor}` : ''}
${suburb ? `- Suburb: ${suburb}` : ''}
${postcode ? `- Postcode: ${postcode}` : ''}
${price ? `- Price guide: $${parseInt(price).toLocaleString()}` : ''}

Rules:
- Do NOT mention the price in the description
- Do NOT use phrases like "this property offers" or "don't miss out"
- Focus on location appeal, property type, layout, and lifestyle
- Keep it under 80 words
- Write in third person, present tense
- End with a line about the suburb or lifestyle, not a call to action`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const description = message.content[0].text.trim();
    return res.status(200).json({ description });
  } catch (err) {
    console.error('Description generation error:', err.message);
    return res.status(500).json({ error: 'Failed to generate description. Try again.' });
  }
};
