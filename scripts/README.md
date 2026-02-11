# Restaurant Homepage Generator

A Python script that automatically generates beautiful, responsive HTML homepages for restaurants from CSV data. The script extracts restaurant information and social media details to create modern, professional-looking websites.

## Features

- 🎨 **Modern Design**: Clean, responsive layouts with beautiful gradients and animations
- 📱 **Mobile-Friendly**: Fully responsive design that works on all devices
- 🔗 **Social Media Integration**: Automatically extracts and displays Instagram and Facebook links
- 🍽️ **Restaurant-Specific Content**: Customized content based on cuisine type and location
- ⚡ **Fast Generation**: Creates multiple homepages from CSV data in seconds
- 🎯 **SEO-Ready**: Proper HTML structure with meta tags and semantic markup

## Generated Homepages Include

- Hero section with restaurant name and description
- About section with cuisine type and location
- Menu section with food categories
- Social media links (Instagram/Facebook)
- Contact information
- Responsive navigation
- Beautiful animations and hover effects

## Files Created

The script generates:
- Individual HTML files for each restaurant in the `restaurant_homepages/` directory
- An index page (`restaurant_homepages/index.html`) to showcase all homepages
- Clean, semantic HTML with modern CSS styling

## Usage

### Prerequisites

- Python 3.6 or higher
- CSV file with restaurant data (see format below)

### Running the Script

1. Place your CSV file in the same directory as the script
2. Run the script:
   ```bash
   python3 restaurant_homepage_generator.py
   ```
3. Check the `restaurant_homepages/` directory for generated files

### CSV Format

Your CSV file should have the following columns:

```csv
Restaurant,Address,Cuisine/Type,Social Media Presence
"Restaurant Name","Full Address","Cuisine description","Instagram (@handle); Facebook (Page Name)"
```

### Social Media Format

The script automatically extracts social media information from the "Social Media Presence" column:

- **Instagram**: `Instagram (@username)`
- **Facebook**: `Facebook (Page Name)`
- **Multiple**: `Instagram (@username); Facebook (Page Name)`
- **None**: `No official social media` or `None`

## Example Output

For the restaurant "Beans & Bites" with Instagram `@beansandbiteshackney`, the script generates:

- **File**: `beans__bites.html`
- **Features**: 
  - Restaurant name and description
  - Address and cuisine type
  - Instagram link with icon
  - Responsive design
  - Modern styling

## Viewing the Homepages

### Option 1: Direct File Opening
Open any HTML file directly in your web browser.

### Option 2: Local Server (Recommended)
For the best experience, serve the files using a local server:

```bash
cd restaurant_homepages
python3 -m http.server 8000
```

Then visit `http://localhost:8000` in your browser.

## Customization

The script can be easily customized by modifying:

- **Colors**: Update CSS variables in the `generate_homepage()` function
- **Layout**: Modify the HTML structure and CSS grid systems
- **Content**: Add more sections or modify existing ones
- **Styling**: Change fonts, animations, or overall design

## Technical Details

- **Language**: Python 3
- **Dependencies**: Standard library only (csv, os, re, datetime)
- **Output**: HTML5 with CSS3 and Font Awesome icons
- **Responsive**: Mobile-first design with CSS Grid and Flexbox
- **Performance**: Lightweight, fast-loading pages

## Sample Data

The script was tested with the `HakcneyResturants.csv` file containing:

- 6 restaurants in Hackney, London
- Various cuisine types (brunch, coffee, Caribbean, etc.)
- Mixed social media presence (some with Instagram/Facebook, some without)

## Generated Files

After running the script, you'll find:

```
restaurant_homepages/
├── index.html                    # Main showcase page
├── beans__bites.html            # Beans & Bites homepage
├── the_full_english.html        # The Full English homepage
├── sons_coffee_kiosk.html       # Sons coffee kiosk homepage
├── mess_cafe.html               # Mess Cafe homepage
├── peoples_choice_caribbean.html # People's Choice Caribbean homepage
└── rainbow_cookout.html         # Rainbow Cookout homepage
```

## Features of Generated Homepages

- ✅ **Responsive Design**: Works on desktop, tablet, and mobile
- ✅ **Modern UI**: Clean, professional appearance
- ✅ **Social Media Integration**: Automatic Instagram/Facebook links
- ✅ **SEO Optimized**: Proper meta tags and semantic HTML
- ✅ **Fast Loading**: Optimized CSS and minimal dependencies
- ✅ **Accessible**: Proper heading structure and alt text
- ✅ **Cross-Browser Compatible**: Works in all modern browsers

## License

This project is open source and available under the MIT License. 