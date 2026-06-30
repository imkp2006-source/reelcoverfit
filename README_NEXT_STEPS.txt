ReelCoverFit updated files

Upload/replace these files on your hosting:
- index.html
- style.css
- script.js
- instagram-reel-cover-size.html
- why-instagram-reel-cover-cropped.html

After upload, test:
1. Open reelcoverfit.com.
2. Click Check My Reel Cover.
3. Upload an image.
4. Download preview.
5. Open Google Analytics Realtime / DebugView and confirm these events appear:
   - image_upload
   - cover_checked
   - cover_download
   - feedback_click if you click feedback

In GA4 Admin > Data display > Events, mark these as key events:
- cover_download
- feedback_click
- contact_click

Then in Google Search Console:
- Inspect https://reelcoverfit.com/
- Request indexing.
- Inspect and request indexing for the two new guide pages.
