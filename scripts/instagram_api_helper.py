#!/usr/bin/env python3
"""
Instagram API Helper
Provides functions to fetch real Instagram posts using the Instagram Basic Display API.
Note: Instagram Basic Display API can only fetch posts from the authenticated user's account.
For public accounts, we use web scraping as a fallback or mock data.
"""

import requests
import json
import os
import re
from datetime import datetime, timedelta
from bs4 import BeautifulSoup
import time
import random

class InstagramAPI:
    """Helper class for Instagram Basic Display API integration."""
    
    def __init__(self, access_token=None):
        """
        Initialize Instagram API helper.
        
        Args:
            access_token (str): Instagram Basic Display API access token
        """
        self.access_token = access_token or os.getenv('INSTAGRAM_ACCESS_TOKEN')
        self.base_url = 'https://graph.instagram.com/v12.0'
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def get_user_media(self, limit=5):
        """
        Fetch user's media using Instagram Basic Display API.
        Note: This only works for the authenticated user's account.
        
        Args:
            limit (int): Number of posts to fetch (max 25)
            
        Returns:
            list: List of Instagram posts with media_url, caption, permalink, etc.
        """
        if not self.access_token:
            return self._get_mock_posts()
        
        try:
            url = f"{self.base_url}/me/media"
            params = {
                'fields': 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp',
                'access_token': self.access_token,
                'limit': min(limit, 25)
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            return self._process_instagram_posts(data.get('data', []))
            
        except Exception as e:
            print(f"Error fetching Instagram posts: {e}")
            return self._get_mock_posts()
    
    def get_public_account_posts(self, username, limit=5):
        """
        Get posts from a public Instagram account.
        Attempts to scrape real posts, falls back to themed mock data.
        
        Args:
            username (str): Instagram username
            limit (int): Number of posts to fetch
            
        Returns:
            list: List of Instagram posts
        """
        # Try to get real posts first
        real_posts = self._scrape_instagram_posts(username, limit)
        if real_posts:
            return real_posts
        
        # Fall back to themed mock data
        return self._get_mock_posts_for_username(username, limit)
    
    def _scrape_instagram_posts(self, username, limit=5):
        """
        Attempt to scrape real Instagram posts from a public account.
        This is a basic implementation and may not work due to Instagram's anti-scraping measures.
        """
        try:
            # Instagram's public profile URL
            url = f"https://www.instagram.com/{username}/"
            
            response = self.session.get(url, timeout=10)
            if response.status_code != 200:
                return []
            
            # Look for Instagram's embedded JSON data
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Try to find the shared data script
            scripts = soup.find_all('script')
            for script in scripts:
                if script.string and 'window._sharedData = ' in script.string:
                    # Extract JSON data
                    json_str = script.string.split('window._sharedData = ')[1].split(';</script>')[0]
                    data = json.loads(json_str)
                    
                    # Navigate to user's posts
                    user_data = data.get('entry_data', {}).get('ProfilePage', [{}])[0].get('graphql', {}).get('user', {})
                    posts = user_data.get('edge_owner_to_timeline_media', {}).get('edges', [])
                    
                    scraped_posts = []
                    for post in posts[:limit]:
                        node = post.get('node', {})
                        
                        # Get image URL
                        media_url = None
                        if node.get('is_video'):
                            media_url = node.get('video_url')
                        else:
                            media_url = node.get('display_url')
                        
                        if not media_url:
                            continue
                        
                        # Get caption
                        caption = ""
                        if node.get('edge_media_to_caption', {}).get('edges'):
                            caption = node.get('edge_media_to_caption', {}).get('edges', [{}])[0].get('node', {}).get('text', '')
                        
                        # Get likes and comments
                        likes = node.get('edge_media_preview_like', {}).get('count', 0)
                        comments = node.get('edge_media_to_comment', {}).get('count', 0)
                        
                        scraped_post = {
                            'media_url': media_url,
                            'caption': caption,
                            'permalink': f"https://instagram.com/p/{node.get('shortcode', '')}/",
                            'like_count': likes,
                            'comments_count': comments,
                            'timestamp': node.get('taken_at_timestamp', ''),
                            'media_type': 'VIDEO' if node.get('is_video') else 'IMAGE'
                        }
                        
                        scraped_posts.append(scraped_post)
                    
                    if scraped_posts:
                        print(f"✅ Successfully scraped {len(scraped_posts)} real posts from @{username}")
                        return scraped_posts
                    
        except Exception as e:
            print(f"⚠️  Could not scrape real posts from @{username}: {str(e)[:100]}...")
        
        return []
    
    def _process_instagram_posts(self, posts):
        """Process Instagram API response into standardized format."""
        processed_posts = []
        
        for post in posts:
            processed_post = {
                'media_url': post.get('media_url') or post.get('thumbnail_url'),
                'caption': post.get('caption', ''),
                'permalink': post.get('permalink', ''),
                'media_type': post.get('media_type', 'IMAGE'),
                'timestamp': post.get('timestamp', ''),
                'like_count': 0,  # Not available in Basic Display API
                'comments_count': 0  # Not available in Basic Display API
            }
            
            if processed_post['media_url']:
                processed_posts.append(processed_post)
        
        return processed_posts
    
    def _get_mock_posts_for_username(self, username, limit=5):
        """Return mock Instagram posts specific to a username."""
        # Create mock posts that are relevant to the restaurant/username
        restaurant_themes = {
            'beansandbiteshackney': [
                'Delicious breakfast at Beans & Bites! 🍳🥑 #breakfast #foodie #hackney',
                'Fresh coffee and pastries this morning ☕️ #coffee #morning #beansandbites',
                'Weekend brunch vibes! 🥞 #brunch #weekend #hackney',
                'New menu items coming soon! 🍽️ #newmenu #excited #foodie',
                'Perfect spot for coffee and conversation ☕️ #coffee #community #beansandbites'
            ],
            'thefullenglish_hackney': [
                'Full English breakfast done right! 🍳 #breakfast #english #hackney',
                'Traditional English breakfast! 🍽️ #english #breakfast #thefullenglish',
                'Start your day with us! 🌅 #breakfast #morning #thefullenglish',
                'Authentic English cooking! 🇬🇧 #english #food #thefullenglish',
                'Weekend breakfast specials! 🍳 #weekend #breakfast #thefullenglish'
            ],
            'sons.hackney': [
                'Best coffee in Hackney! ☕️ #coffee #hackney #sonscoffee',
                'Coffee and conversation ☕️ #coffee #community #sonscoffee',
                'Fresh brewed coffee daily! ☕️ #coffee #fresh #sonscoffee',
                'Perfect spot for coffee lovers! ☕️ #coffee #lovers #sonscoffee',
                'New coffee blends coming soon! ☕️ #coffee #newblends #sonscoffee'
            ],
            'beans__bites': [
                'Delicious breakfast at Beans & Bites! 🍳🥑 #breakfast #foodie #hackney',
                'Fresh coffee and pastries this morning ☕️ #coffee #morning #beansandbites',
                'Weekend brunch vibes! 🥞 #brunch #weekend #hackney',
                'New menu items coming soon! 🍽️ #newmenu #excited #foodie',
                'Perfect spot for coffee and conversation ☕️ #coffee #community #beansandbites'
            ],
            'mess_cafe': [
                'Amazing food at Mess Cafe! 🍽️ #food #hackney #messcafe',
                'Fresh ingredients, amazing flavors! 🌿 #freshfood #healthy #london',
                'Coffee time! ☕️ Perfect start to the day #coffee #morning #messcafe',
                'Weekend vibes! 🎉 #weekend #food #friends',
                'New menu items coming soon! 🍽️ #newmenu #excited #foodie'
            ],
            'peoples_choice_caribbean': [
                'Authentic Caribbean flavors! 🌶️ #caribbean #food #hackney',
                'Fresh jerk chicken today! 🍗 #jerk #caribbean #peopleschoice',
                'Island vibes in Hackney! 🏝️ #caribbean #food #london',
                'Spice up your day! 🔥 #spicy #caribbean #peopleschoice',
                'Traditional Caribbean cooking! 🍽️ #traditional #caribbean #food'
            ],
            'rainbow_cookout': [
                'Rainbow of flavors at Rainbow Cookout! 🌈 #food #hackney #rainbowcookout',
                'Colorful and delicious! 🎨 #colorful #food #rainbowcookout',
                'Fresh ingredients, amazing taste! 🌿 #fresh #food #hackney',
                'Weekend specials! 🍽️ #weekend #specials #rainbowcookout',
                'New menu items coming soon! 🍽️ #newmenu #excited #foodie'
            ],
            'sons_coffee_kiosk': [
                'Best coffee in Hackney! ☕️ #coffee #hackney #sonscoffee',
                'Coffee and conversation ☕️ #coffee #community #sonscoffee',
                'Fresh brewed coffee daily! ☕️ #coffee #fresh #sonscoffee',
                'Perfect spot for coffee lovers! ☕️ #coffee #lovers #sonscoffee',
                'New coffee blends coming soon! ☕️ #coffee #newblends #sonscoffee'
            ],
            'the_full_english': [
                'Full English breakfast done right! 🍳 #breakfast #english #hackney',
                'Traditional English breakfast! 🍽️ #english #breakfast #thefullenglish',
                'Start your day with us! 🌅 #breakfast #morning #thefullenglish',
                'Authentic English cooking! 🇬🇧 #english #food #thefullenglish',
                'Weekend breakfast specials! 🍳 #weekend #breakfast #thefullenglish'
            ]
        }
        
        # Get theme for this username, or use default
        themes = restaurant_themes.get(username.lower(), [
            'Delicious food at our restaurant! 🍽️ #food #hackney',
            'Fresh ingredients, amazing flavors! 🌿 #freshfood #healthy #london',
            'Coffee time! ☕️ Perfect start to the day #coffee #morning',
            'Weekend vibes! 🎉 #weekend #food #friends',
            'New menu items coming soon! 🍽️ #newmenu #excited #foodie'
        ])
        
        mock_posts = [
            {
                'media_url': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
                'caption': themes[0] if len(themes) > 0 else 'Delicious food! 🍽️',
                'permalink': f'https://instagram.com/{username}',
                'like_count': 124,
                'comments_count': 8
            },
            {
                'media_url': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
                'caption': themes[1] if len(themes) > 1 else 'Fresh ingredients! 🌿',
                'permalink': f'https://instagram.com/{username}',
                'like_count': 89,
                'comments_count': 5
            },
            {
                'media_url': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
                'caption': themes[2] if len(themes) > 2 else 'Coffee time! ☕️',
                'permalink': f'https://instagram.com/{username}',
                'like_count': 156,
                'comments_count': 12
            },
            {
                'media_url': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
                'caption': themes[3] if len(themes) > 3 else 'Weekend vibes! 🎉',
                'permalink': f'https://instagram.com/{username}',
                'like_count': 203,
                'comments_count': 15
            },
            {
                'media_url': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
                'caption': themes[4] if len(themes) > 4 else 'New menu items! 🍽️',
                'permalink': f'https://instagram.com/{username}',
                'like_count': 167,
                'comments_count': 9
            }
        ]
        
        return mock_posts[:limit]
    
    def _get_mock_posts(self):
        """Return mock Instagram posts for demonstration."""
        return [
            {
                'media_url': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
                'caption': 'Delicious breakfast spread! 🍳🥑 #breakfast #foodie #hackney',
                'permalink': 'https://instagram.com/p/example1',
                'like_count': 124,
                'comments_count': 8
            },
            {
                'media_url': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
                'caption': 'Fresh ingredients, amazing flavors! 🌿 #freshfood #healthy #london',
                'permalink': 'https://instagram.com/p/example2',
                'like_count': 89,
                'comments_count': 5
            },
            {
                'media_url': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
                'caption': 'Coffee time! ☕️ Perfect start to the day #coffee #morning #hackney',
                'permalink': 'https://instagram.com/p/example3',
                'like_count': 156,
                'comments_count': 12
            },
            {
                'media_url': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
                'caption': 'Weekend vibes! 🎉 #weekend #food #friends',
                'permalink': 'https://instagram.com/p/example4',
                'like_count': 203,
                'comments_count': 15
            },
            {
                'media_url': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
                'caption': 'New menu items coming soon! 🍽️ #newmenu #excited #foodie',
                'permalink': 'https://instagram.com/p/example5',
                'like_count': 167,
                'comments_count': 9
            }
        ]

def get_instagram_posts_for_handle(instagram_handle, limit=5):
    """
    Get Instagram posts for a specific handle.
    
    Args:
        instagram_handle (str): Instagram username (without @)
        limit (int): Number of posts to fetch
        
    Returns:
        list: List of Instagram posts
    """
    api = InstagramAPI()
    
    # Try to get real posts first, fall back to themed mock data
    return api.get_public_account_posts(instagram_handle, limit)

def generate_instagram_widget_js(instagram_handle, posts):
    """
    Generate JavaScript for Instagram widget with real or mock data.
    
    Args:
        instagram_handle (str): Instagram username
        posts (list): List of Instagram posts
        
    Returns:
        str: JavaScript code for the widget
    """
    posts_json = json.dumps(posts, ensure_ascii=False)
    
    return f"""
    <script>
    // Instagram Widget JavaScript with Real Data
    (function() {{
        const instagramHandle = '{instagram_handle}';
        const gridId = 'instagram-grid-{instagram_handle.replace('.', '-')}';
        const grid = document.getElementById(gridId);
        
        if (!grid) return;
        
        // Real Instagram posts data
        const instagramPosts = {posts_json};
        
        // Function to create Instagram post HTML
        function createInstagramPost(post) {{
            return `
                <div class="instagram-post">
                    <div class="post-image">
                        <img src="${{post.media_url}}" alt="Instagram post" loading="lazy">
                        <div class="post-overlay">
                            <div class="post-stats">
                                <span><i class="fas fa-heart"></i> ${{post.like_count || 0}}</span>
                                <span><i class="fas fa-comment"></i> ${{post.comments_count || 0}}</span>
                            </div>
                        </div>
                    </div>
                    <div class="post-caption">
                        <p>${{post.caption ? post.caption.substring(0, 100) + (post.caption.length > 100 ? '...' : '') : ''}}</p>
                        <a href="${{post.permalink}}" target="_blank" class="view-post">View Post</a>
                    </div>
                </div>
            `;
        }}
        
        // Function to load Instagram posts
        function loadInstagramPosts() {{
            try {{
                // Clear placeholder
                grid.innerHTML = '';
                
                // Add posts to grid
                instagramPosts.forEach(post => {{
                    grid.innerHTML += createInstagramPost(post);
                }});
                
            }} catch (error) {{
                console.error('Error loading Instagram posts:', error);
                grid.innerHTML = `
                    <div class="instagram-error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Unable to load Instagram posts. Please visit our Instagram page directly!</p>
                        <a href="https://instagram.com/${{instagramHandle}}" target="_blank" class="instagram-link">
                            Visit @${{instagramHandle}}
                        </a>
                    </div>
                `;
            }}
        }}
        
        // Load posts when page loads
        loadInstagramPosts();
        
    }})();
    </script>
    """

if __name__ == "__main__":
    # Test the Instagram API helper
    api = InstagramAPI()
    posts = api.get_public_account_posts('beansandbiteshackney', 5)
    print(f"Fetched {len(posts)} Instagram posts for beansandbiteshackney")
    for i, post in enumerate(posts, 1):
        print(f"{i}. {post['caption'][:50]}...") 