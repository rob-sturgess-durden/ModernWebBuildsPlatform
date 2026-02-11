#!/usr/bin/env python3
"""
Restaurant Homepage Generator with Instagram Scraper
Creates modern, responsive HTML homepages for restaurants from CSV data with Instagram image scraping.
"""

import csv
import os
import re
import json
from datetime import datetime
from instagram_scraper import get_instagram_images_for_username

def extract_social_media(social_media_text):
    """Extract Instagram and Facebook handles from social media text."""
    instagram = None
    facebook = None
    
    if social_media_text and social_media_text.lower() != "none" and "no official social media" not in social_media_text.lower():
        # Extract Instagram handles
        instagram_match = re.search(r'instagram\s*\(@([^)]+)\)', social_media_text, re.IGNORECASE)
        if instagram_match:
            instagram = instagram_match.group(1)
        
        # Extract Facebook page names
        facebook_match = re.search(r'facebook\s*\(([^)]+)\)', social_media_text, re.IGNORECASE)
        if facebook_match:
            facebook = facebook_match.group(1)
    
    return instagram, facebook

def generate_instagram_widget(instagram_handle):
    """Generate Instagram widget HTML with scraped data."""
    if not instagram_handle:
        return ""
    
    # Fetch Instagram posts using scraper
    posts = get_instagram_images_for_username(instagram_handle, limit=5)
    
    # Generate JavaScript with scraped data
    posts_json = json.dumps(posts, ensure_ascii=False)
    
    widget_html = f"""
    <section class="instagram-widget">
        <div class="main-content">
            <h2>Latest from Instagram</h2>
            <div class="instagram-feed">
                <div class="instagram-header">
                    <i class="fab fa-instagram"></i>
                    <h3>@{instagram_handle}</h3>
                    <a href="https://instagram.com/{instagram_handle}" target="_blank" class="follow-button">
                        Follow on Instagram
                    </a>
                </div>
                <div class="instagram-grid" id="instagram-grid-{instagram_handle.replace('.', '-')}">
                    <!-- Instagram posts will be loaded here via JavaScript -->
                    <div class="instagram-placeholder">
                        <i class="fab fa-instagram"></i>
                        <p>Loading latest posts...</p>
                    </div>
                </div>
            </div>
        </div>
    </section>
    
    <script>
    // Instagram Widget JavaScript with Scraped Data
    (function() {{
        const instagramHandle = '{instagram_handle}';
        const gridId = 'instagram-grid-{instagram_handle.replace('.', '-')}';
        const grid = document.getElementById(gridId);
        
        if (!grid) return;
        
        // Scraped Instagram posts data
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
    
    return widget_html

def generate_homepage(restaurant_data):
    """Generate HTML homepage for a restaurant."""
    restaurant_name = restaurant_data['Restaurant']
    address = restaurant_data['Address']
    cuisine_type = restaurant_data['Cuisine/Type']
    social_media = restaurant_data['Social Media Presence']
    
    instagram, facebook = extract_social_media(social_media)
    
    # Create a clean filename
    filename = re.sub(r'[^\w\s-]', '', restaurant_name).strip().replace(' ', '_').lower()
    
    # Generate Instagram widget if Instagram handle exists
    instagram_widget = generate_instagram_widget(instagram) if instagram else ""
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{restaurant_name} - Hackney's Finest</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #fafafa;
        }}
        
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1rem 0;
            position: fixed;
            width: 100%;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        
        .nav {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        
        .logo {{
            font-size: 1.5rem;
            font-weight: 700;
            text-decoration: none;
            color: white;
        }}
        
        .nav-links {{
            display: flex;
            list-style: none;
            gap: 2rem;
        }}
        
        .nav-links a {{
            color: white;
            text-decoration: none;
            font-weight: 500;
            transition: opacity 0.3s;
        }}
        
        .nav-links a:hover {{
            opacity: 0.8;
        }}
        
        .hero {{
            background: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80');
            background-size: cover;
            background-position: center;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            color: white;
            margin-top: 70px;
        }}
        
        .hero-content h1 {{
            font-size: 3.5rem;
            font-weight: 700;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        }}
        
        .hero-content p {{
            font-size: 1.2rem;
            margin-bottom: 2rem;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
        }}
        
        .cta-button {{
            background: #ff6b6b;
            color: white;
            padding: 1rem 2rem;
            border: none;
            border-radius: 50px;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            text-decoration: none;
            display: inline-block;
        }}
        
        .cta-button:hover {{
            background: #ff5252;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(255,107,107,0.4);
        }}
        
        .main-content {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 4rem 2rem;
        }}
        
        .section {{
            margin-bottom: 4rem;
        }}
        
        .section h2 {{
            font-size: 2.5rem;
            font-weight: 600;
            margin-bottom: 2rem;
            color: #2c3e50;
            text-align: center;
        }}
        
        .about-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 3rem;
        }}
        
        .about-card {{
            background: white;
            padding: 2rem;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            text-align: center;
            transition: transform 0.3s;
        }}
        
        .about-card:hover {{
            transform: translateY(-5px);
        }}
        
        .about-card i {{
            font-size: 3rem;
            color: #667eea;
            margin-bottom: 1rem;
        }}
        
        .about-card h3 {{
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: #2c3e50;
        }}
        
        .about-card p {{
            color: #666;
            line-height: 1.6;
        }}
        
        .social-media {{
            background: #f8f9fa;
            padding: 3rem 0;
            text-align: center;
        }}
        
        .social-grid {{
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin-top: 2rem;
            flex-wrap: wrap;
        }}
        
        .social-card {{
            background: white;
            padding: 2rem;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            min-width: 200px;
            transition: transform 0.3s;
        }}
        
        .social-card:hover {{
            transform: translateY(-5px);
        }}
        
        .social-card i {{
            font-size: 2.5rem;
            margin-bottom: 1rem;
        }}
        
        .instagram i {{
            color: #e4405f;
        }}
        
        .facebook i {{
            color: #1877f2;
        }}
        
        .social-card h3 {{
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }}
        
        .social-card a {{
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }}
        
        /* Instagram Widget Styles */
        .instagram-widget {{
            background: linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%);
            padding: 4rem 0;
            color: white;
        }}
        
        .instagram-widget h2 {{
            color: white;
            margin-bottom: 3rem;
        }}
        
        .instagram-feed {{
            background: white;
            border-radius: 20px;
            padding: 2rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }}
        
        .instagram-header {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #eee;
        }}
        
        .instagram-header i {{
            font-size: 2rem;
            color: #e4405f;
        }}
        
        .instagram-header h3 {{
            color: #333;
            font-size: 1.3rem;
            font-weight: 600;
        }}
        
        .follow-button {{
            background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.9rem;
            transition: transform 0.3s;
        }}
        
        .follow-button:hover {{
            transform: translateY(-2px);
        }}
        
        .instagram-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
        }}
        
        .instagram-post {{
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            transition: transform 0.3s;
        }}
        
        .instagram-post:hover {{
            transform: translateY(-5px);
        }}
        
        .post-image {{
            position: relative;
            height: 200px;
            overflow: hidden;
        }}
        
        .post-image img {{
            width: 100%;
            height: 100%;
            object-fit: cover;
        }}
        
        .post-overlay {{
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s;
        }}
        
        .instagram-post:hover .post-overlay {{
            opacity: 1;
        }}
        
        .post-stats {{
            color: white;
            display: flex;
            gap: 1rem;
            font-weight: 600;
        }}
        
        .post-stats span {{
            display: flex;
            align-items: center;
            gap: 0.3rem;
        }}
        
        .post-caption {{
            padding: 1rem;
        }}
        
        .post-caption p {{
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
            line-height: 1.4;
        }}
        
        .view-post {{
            color: #e4405f;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.8rem;
        }}
        
        .instagram-placeholder {{
            grid-column: 1 / -1;
            text-align: center;
            padding: 3rem;
            color: #666;
        }}
        
        .instagram-placeholder i {{
            font-size: 3rem;
            color: #e4405f;
            margin-bottom: 1rem;
        }}
        
        .instagram-error {{
            grid-column: 1 / -1;
            text-align: center;
            padding: 2rem;
            color: #666;
        }}
        
        .instagram-error i {{
            font-size: 2rem;
            color: #ff6b6b;
            margin-bottom: 1rem;
        }}
        
        .instagram-link {{
            color: #e4405f;
            text-decoration: none;
            font-weight: 600;
            margin-top: 1rem;
            display: inline-block;
        }}
        
        .footer {{
            background: #2c3e50;
            color: white;
            text-align: center;
            padding: 2rem 0;
        }}
        
        .footer p {{
            margin-bottom: 1rem;
        }}
        
        .footer a {{
            color: #667eea;
            text-decoration: none;
        }}
        
        @media (max-width: 768px) {{
            .hero-content h1 {{
                font-size: 2.5rem;
            }}
            
            .nav-links {{
                display: none;
            }}
            
            .about-grid {{
                grid-template-columns: 1fr;
            }}
            
            .social-grid {{
                flex-direction: column;
                align-items: center;
            }}
            
            .instagram-grid {{
                grid-template-columns: 1fr;
            }}
            
            .instagram-header {{
                flex-direction: column;
                gap: 1rem;
                text-align: center;
            }}
        }}
    </style>
</head>
<body>
    <header class="header">
        <nav class="nav">
            <a href="#" class="logo">{restaurant_name}</a>
            <ul class="nav-links">
                <li><a href="#about">About</a></li>
                <li><a href="#menu">Menu</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </nav>
    </header>

    <section class="hero">
        <div class="hero-content">
            <h1>{restaurant_name}</h1>
            <p>Experience the finest {cuisine_type.lower()} in the heart of Hackney. Fresh ingredients, authentic flavors, and warm hospitality await you.</p>
            <a href="#menu" class="cta-button">View Our Menu</a>
        </div>
    </section>

    <main class="main-content">
        <section id="about" class="section">
            <h2>About {restaurant_name}</h2>
            <div class="about-grid">
                <div class="about-card">
                    <i class="fas fa-utensils"></i>
                    <h3>Our Cuisine</h3>
                    <p>{cuisine_type}</p>
                </div>
                <div class="about-card">
                    <i class="fas fa-map-marker-alt"></i>
                    <h3>Location</h3>
                    <p>{address}</p>
                </div>
                <div class="about-card">
                    <i class="fas fa-heart"></i>
                    <h3>Our Promise</h3>
                    <p>We're committed to serving you the most delicious and authentic dishes, made with love and the finest ingredients.</p>
                </div>
            </div>
        </section>

        <section id="menu" class="section">
            <h2>Our Menu</h2>
            <div class="about-grid">
                <div class="about-card">
                    <i class="fas fa-sun"></i>
                    <h3>Breakfast</h3>
                    <p>Start your day with our delicious breakfast options, featuring fresh ingredients and traditional favorites.</p>
                </div>
                <div class="about-card">
                    <i class="fas fa-coffee"></i>
                    <h3>Beverages</h3>
                    <p>Enjoy our selection of premium coffees, teas, and specialty drinks made with care.</p>
                </div>
                <div class="about-card">
                    <i class="fas fa-star"></i>
                    <h3>Specialties</h3>
                    <p>Discover our signature dishes that have made us a beloved part of the Hackney community.</p>
                </div>
            </div>
        </section>
    </main>

    {instagram_widget}

    <section class="social-media">
        <div class="main-content">
            <h2>Follow Us</h2>
            <div class="social-grid">
                {f'<div class="social-card instagram"><i class="fab fa-instagram"></i><h3>Instagram</h3><a href="https://instagram.com/{instagram}" target="_blank">@{instagram}</a></div>' if instagram else ''}
                {f'<div class="social-card facebook"><i class="fab fa-facebook"></i><h3>Facebook</h3><a href="https://facebook.com/{facebook}" target="_blank">{facebook}</a></div>' if facebook else ''}
                {f'<div class="social-card"><i class="fas fa-phone"></i><h3>Contact</h3><p>Visit us at {address}</p></div>' if not instagram and not facebook else ''}
            </div>
        </div>
    </section>

    <footer class="footer">
        <div class="main-content">
            <p>&copy; 2024 {restaurant_name}. All rights reserved.</p>
            <p>Located at {address}</p>
            <p>Generated on {datetime.now().strftime('%B %d, %Y')}</p>
        </div>
    </footer>
</body>
</html>"""
    
    return filename, html_content

def main():
    """Main function to process CSV and generate homepages with Instagram scraping."""
    csv_file = 'HakcneyResturants.csv'
    output_dir = 'restaurant_homepages_scraper'
    
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Read CSV file
    restaurants = []
    try:
        with open(csv_file, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                restaurants.append(row)
    except FileNotFoundError:
        print(f"Error: {csv_file} not found!")
        return
    except Exception as e:
        print(f"Error reading CSV file: {e}")
        return
    
    print(f"Found {len(restaurants)} restaurants in {csv_file}")
    print(f"Generating homepages with Instagram scraping in '{output_dir}' directory...\n")
    
    # Generate homepages for each restaurant
    for i, restaurant in enumerate(restaurants, 1):
        try:
            filename, html_content = generate_homepage(restaurant)
            filepath = os.path.join(output_dir, f"{filename}.html")
            
            with open(filepath, 'w', encoding='utf-8') as file:
                file.write(html_content)
            
            print(f"{i}. ✅ {restaurant['Restaurant']}")
            print(f"   📁 {filepath}")
            
            # Show social media info
            instagram, facebook = extract_social_media(restaurant['Social Media Presence'])
            if instagram:
                print(f"   📸 Instagram: @{instagram} (with scraped images)")
            if facebook:
                print(f"   📘 Facebook: {facebook}")
            if not instagram and not facebook:
                print(f"   ℹ️  No social media found")
            print()
            
        except Exception as e:
            print(f"❌ Error generating homepage for {restaurant['Restaurant']}: {e}")
    
    print(f"🎉 Successfully generated {len(restaurants)} restaurant homepages with Instagram scraping!")
    print(f"📂 Check the '{output_dir}' folder for all HTML files.")
    print("\nTo view the homepages:")
    print("1. Open the HTML files in your web browser")
    print("2. Or serve them using a local server: python -m http.server")
    print("\nNote: Instagram images are fetched using web scraping techniques.")
    print("If scraping fails, the widgets will show relevant mock images.")

if __name__ == "__main__":
    main() 