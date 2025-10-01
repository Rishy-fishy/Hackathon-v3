## How to Remove Pending Upload Records

You have several options to clear the "PENDING UPLOAD" status records:

### Option 1: Using Browser Console (Immediate Fix)

1. Open your app in the browser (http://localhost:3001 or wherever it's running)
2. Press **F12** or **Ctrl+Shift+I** to open Developer Tools
3. Go to the **Console** tab
4. Paste this code and press Enter:

```javascript
// Clear all pending records immediately
(async function() {
  // Open the IndexedDB database
  const request = indexedDB.open('nutrition_app', 2);
  
  request.onsuccess = function(event) {
    const db = event.target.result;
    const transaction = db.transaction(['childRecords'], 'readwrite');
    const store = transaction.objectStore('childRecords');
    
    // Get all records
    const getAllRequest = store.getAll();
    
    getAllRequest.onsuccess = function() {
      const records = getAllRequest.result;
      let deletedCount = 0;
      
      // Find and delete pending/failed records
      records.forEach(record => {
        if (record.status === 'pending' || 
            record.status === 'failed' || 
            (!record.uploadedAt && record.status !== 'uploaded')) {
          store.delete(record.healthId);
          deletedCount++;
        }
      });
      
      console.log(`✅ Cleared ${deletedCount} pending records`);
      alert(`Successfully cleared ${deletedCount} pending records! Refresh the page to see changes.`);
    };
  };
  
  request.onerror = function() {
    console.error('❌ Failed to open database');
  };
})();
```

5. Refresh the page to see the changes

### Option 2: Using the New Clear Button (Permanent Solution)

I've added a **"🗑️ Clear Pending"** button to your ViewData component:
- It appears next to the Upload button
- Click it to remove all pending records
- Includes a confirmation dialog for safety

### Option 3: Manual Database Reset

If you want to completely reset your local database:

```javascript
// Complete database reset (removes ALL local records)
indexedDB.deleteDatabase('nutrition_app');
alert('Database cleared! Refresh the page.');
```

### Why This Happens

The "PENDING UPLOAD" status occurs when:
1. Records are created locally but haven't been uploaded to your server
2. Upload attempts failed and left records in "pending" or "failed" state
3. Records exist without an `uploadedAt` timestamp

### Recommendation

Use **Option 1** (browser console) for an immediate fix, then use the new Clear Pending button for future maintenance.