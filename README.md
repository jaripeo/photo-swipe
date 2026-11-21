# SwipeClean

SwipeClean helps you review and clean up photos and videos on your phone.

## Features and controls

- Browse by month, date range, random selection, or file size.
- Swipe left to add an item to Trash.
- Swipe right to keep an item.
- Tap a photo to open it and zoom in.
- Review queued items before deleting them.
- Use the heart button to save favorites inside the app.

## Requirements

- Node.js and npm
- Expo SDK 58
- Expo Go with SDK 58 for phone testing

## Install and start

```bash
npm install
npx expo start
```

If your phone cannot connect over Wi-Fi:

```bash
npx expo start --tunnel
```

## Photo permissions

SwipeClean needs full photo-library access to display and delete photos and videos.

Items stay in SwipeClean's Trash until you review and delete them.

## Test with Expo Go

1. Install Expo Go on your phone.
2. Connect your phone and computer to the same Wi-Fi network.
3. Run `npx expo start`.
4. Scan the QR code with your phone.

## Privacy

Your photos and videos stay on your device. SwipeClean does not upload them to a server.
