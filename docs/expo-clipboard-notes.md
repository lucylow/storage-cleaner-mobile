Expo Clipboard notes from /home/ubuntu/storage-cleaner-mobile_helper/docs/communication/clipboard/DOCS.md:

- expo-clipboard supports Android, iOS, and web.
- setStringAsync is asynchronous and should be awaited with failure handling.
- Web clipboard behavior may prompt for permission and can vary by browser.
- The diagnostic summary contains only privacy-safe counters and statuses, so copying it does not expose file metadata.
- A copy action should report success or failure clearly and should not read from the clipboard.
