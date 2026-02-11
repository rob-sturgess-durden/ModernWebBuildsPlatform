# Instagram API Integration Setup Guide

This guide explains how to set up real Instagram integration for the restaurant homepage generator.

## Overview

The enhanced version of the restaurant homepage generator can fetch real Instagram posts using the Instagram Basic Display API. This allows you to display actual posts from each restaurant's Instagram account.

## Prerequisites

1. **Instagram Business/Creator Account**: The Instagram account must be a Business or Creator account
2. **Facebook Developer Account**: You need a Facebook Developer account to access the Instagram API
3. **Python Environment**: Python 3.6+ with the `requests` library

## Step-by-Step Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "Create App"
3. Select "Business" as the app type
4. Fill in your app details
5. Note down your **App ID** and **App Secret**

### 3. Add Instagram Basic Display

1. In your Facebook app dashboard, go to "Add Products"
2. Find "Instagram Basic Display" and click "Set Up"
3. Add your Instagram account as a test user
4. Generate a long-lived access token

### 4. Get Instagram Access Token

#### Method 1: Using Facebook Graph API Explorer

1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app from the dropdown
3. Add these permissions: `instagram_basic`, `instagram_content_publish`
4. Click "Generate Access Token"
5. Copy the access token

#### Method 2: Using Instagram Basic Display API

1. In your app dashboard, go to "Instagram Basic Display"
2. Click "Basic Display" → "Instagram Test Users"
3. Add your Instagram account
4. Generate a long-lived token

### 5. Set Environment Variable

Set your Instagram access token as an environment variable:

```bash
# On macOS/Linux
export INSTAGRAM_ACCESS_TOKEN="your_access_token_here"

# On Windows
set INSTAGRAM_ACCESS_TOKEN=your_access_token_here
```

Or create a `.env` file:

```bash
INSTAGRAM_ACCESS_TOKEN=your_access_token_here
```

### 6. Test the Integration

Run the enhanced generator:

```bash
python3 restaurant_homepage_generator_enhanced.py
```

## API Limitations

### Instagram Basic Display API

- **Rate Limits**: 200 requests per hour per user
- **Data Available**: 
  - Media URL
  - Caption
  - Permalink
  - Media type
  - Timestamp
- **Not Available**:
  - Like counts
  - Comment counts
  - User engagement metrics

### Instagram Graph API (Alternative)

For more data, you can use the Instagram Graph API, but it requires:
- Facebook Page connected to Instagram Business account
- Additional permissions and setup

## Troubleshooting

### Common Issues

1. **"Invalid access token"**
   - Check if your token is valid and not expired
   - Ensure you have the correct permissions

2. **"Rate limit exceeded"**
   - Wait before making more requests
   - Consider implementing caching

3. **"No posts found"**
   - Ensure the Instagram account has public posts
   - Check if the account is a Business/Creator account

### Debug Mode

Add debug logging to see API responses:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Security Best Practices

1. **Never commit access tokens to version control**
2. **Use environment variables for sensitive data**
3. **Rotate access tokens regularly**
4. **Monitor API usage to stay within limits**

## Example Configuration

Create a `config.py` file:

```python
import os

# Instagram API Configuration
INSTAGRAM_ACCESS_TOKEN = os.getenv('INSTAGRAM_ACCESS_TOKEN')
INSTAGRAM_API_BASE_URL = 'https://graph.instagram.com/v12.0'

# Rate limiting
MAX_REQUESTS_PER_HOUR = 200
REQUEST_TIMEOUT = 10

# Cache settings
CACHE_DURATION = 3600  # 1 hour
```

## Advanced Features

### Caching

Implement caching to reduce API calls:

```python
import json
import time
from pathlib import Path

def cache_instagram_posts(handle, posts):
    cache_file = Path(f"cache/instagram_{handle}.json")
    cache_file.parent.mkdir(exist_ok=True)
    
    cache_data = {
        'timestamp': time.time(),
        'posts': posts
    }
    
    with open(cache_file, 'w') as f:
        json.dump(cache_data, f)

def get_cached_posts(handle, max_age=3600):
    cache_file = Path(f"cache/instagram_{handle}.json")
    
    if cache_file.exists():
        with open(cache_file, 'r') as f:
            cache_data = json.load(f)
        
        if time.time() - cache_data['timestamp'] < max_age:
            return cache_data['posts']
    
    return None
```

### Error Handling

Implement robust error handling:

```python
def fetch_instagram_posts(handle, max_retries=3):
    for attempt in range(max_retries):
        try:
            return get_instagram_posts_for_handle(handle)
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"Failed to fetch Instagram posts for {handle}: {e}")
                return get_mock_posts()
            time.sleep(2 ** attempt)  # Exponential backoff
```

## Production Deployment

For production use:

1. **Use a proper web server** (nginx, Apache)
2. **Implement HTTPS** for security
3. **Set up monitoring** for API usage
4. **Use a CDN** for static assets
5. **Implement proper logging**

## Support

If you encounter issues:

1. Check the [Instagram Basic Display API documentation](https://developers.facebook.com/docs/instagram-basic-display-api)
2. Review the [Facebook Graph API documentation](https://developers.facebook.com/docs/graph-api)
3. Check your app's permissions and settings
4. Verify your access token is valid and has the correct permissions

## License

This integration is provided as-is. Please ensure you comply with Instagram's Terms of Service and API usage policies. 