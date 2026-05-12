const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    const { destination } = req.query;
    
    if (!destination) {
      return res.status(400).json({ error: 'Destination parameter is required' });
    }
    
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) {
      console.error('GEOAPIFY_API_KEY is not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    // Step 1: Geocoding - get coordinates for the destination
    const geocodeUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(destination)}&apiKey=${apiKey}`;
    const geocodeResponse = await fetch(geocodeUrl);
    
    if (!geocodeResponse.ok) {
      throw new Error(`Geocoding API error: ${geocodeResponse.status}`);
    }
    
    const geocodeData = await geocodeResponse.json();
    
    if (!geocodeData.features || geocodeData.features.length === 0) {
      return res.status(404).json({ error: 'Destination not found' });
    }
    
    const { lon, lat } = geocodeData.features[0].properties;
    
    // Step 2: Places API - search for recommended locations around the coordinates
    // Define categories to search for
    const categories = [
      'tourism.attraction',          // Tourist attractions
      'culture.museum, culture.gallery, culture.theatre', // Museums/culture
      'catering.restaurant',         // Restaurants
      'catering.cafe',               // Cafes
      'leisure.park, leisure.garden, natural.reserve', // Parks/nature
      'commercial.shoppingmarket, commercial.supermarket' // Shopping/local markets
    ];
    
    // We'll make multiple requests for different categories to get diverse results
    const placesPromises = categories.map(category => {
      const placesUrl = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(category)}&filter=circle:${lon},${lat},5000&limit=5&apiKey=${apiKey}`;
      return fetch(placesUrl)
        .then(response => {
          if (!response.ok) {
            // If one category fails, we still want to try others
            console.warn(`Places API error for category ${category}: ${response.status}`);
            return { features: [] };
          }
          return response.json();
        })
        .catch(error => {
          console.error(`Places API fetch error for category ${category}:`, error);
          return { features: [] };
        });
    });
    
    const placesResponses = await Promise.all(placesPromises);
    
    // Combine and process results
    const allPlaces = [];
    
    placesResponses.forEach((response, index) => {
      if (response && response.features) {
        response.features.forEach(feature => {
          const properties = feature.properties;
          
          // Extract primary category (first one)
          const primaryCategory = properties.categories ? properties.categories[0] : 'unknown';
          
          // Format category for display
          let displayCategory = primaryCategory;
          if (primaryCategory.includes('tourism.attraction')) displayCategory = 'Atracție turistică';
          else if (primaryCategory.includes('culture.museum')) displayCategory = 'Muzeu';
          else if (primaryCategory.includes('culture.gallery')) displayCategory = 'Galerie de artă';
          else if (primaryCategory.includes('culture.theatre')) displayCategory = 'Teatru';
          else if (primaryCategory.includes('catering.restaurant')) displayCategory = 'Restaurant';
          else if (primaryCategory.includes('catering.cafe')) displayCategory = 'Cafea';
          else if (primaryCategory.includes('leisure.park') || primaryCategory.includes('leisure.garden') || primaryCategory.includes('natural.reserve')) displayCategory = 'Parc/ natură';
          else if (primaryCategory.includes('commercial.shoppingmarket') || primaryCategory.includes('commercial.supermarket')) displayCategory = 'Shopping/ piață locală';
          else {
            // Keep original category but make it more readable
            displayCategory = primaryCategory.replace(/\./g, ' ').replace(/^[a-z]/, c => c.toUpperCase());
          }
          
          // Format address
          const addressParts = [
            properties.address_line2,
            properties.address_line1,
            properties.city,
            properties.state,
            properties.postcode,
            properties.country
          ].filter(part => part && part !== '');
          
          const formattedAddress = addressParts.join(', ');
          
          // Calculate distance (in meters from the center point)
          // Note: Geoapify returns distance when using circle filter
          const distance = properties.distance || 0; // meters
          
          allPlaces.push({
            name: properties.name || 'Locatie necunoscuta',
            category: displayCategory,
            address: formattedAddress.length > 100 ? formattedAddress.substring(0, 97) + '...' : formattedAddress,
            distance: distance,
            lat: properties.lat,
            lon: properties.lon,
            // For Google Maps link
            mapUrl: `https://www.google.com/maps/search/?api=1&query=${properties.lat},${properties.lon}`
          });
        });
      }
    });
    
    // Remove duplicates based on name (simple deduplication)
    const uniquePlaces = [];
    const seenNames = new Set();
    
    for (const place of allPlaces) {
      if (!seenNames.has(place.name.toLowerCase())) {
        seenNames.add(place.name.toLowerCase());
        uniquePlaces.push(place);
      }
    }
    
    // Sort by distance (closest first)
    uniquePlaces.sort((a, b) => a.distance - b.distance);
    
    // Limit to 12 results (similar to existing implementation)
    const limitedPlaces = uniquePlaces.slice(0, 12);
    
    res.status(200).json(limitedPlaces);
  } catch (error) {
    console.error('Error in geoapify endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};