// ─── Appwrite Configuration ─────────────────────────────────────────────
// Shared by both the public site (script.js) and admin (admin/script.js).
// ─────────────────────────────────────────────────────────────────────────

const APPWRITE_ENDPOINT  = 'https://sfo.cloud.appwrite.io/v1';
const APPWRITE_PROJECT   = '6a1a4b1400157f5c8c30';

// =========================================================================
// ACTION REQUIRED — Fill these in after creating them in the Appwrite Console:
//
//  1. Go to  Appwrite Console → Databases → "Create Database"
//     → copy the Database ID here.
//
//  2. Inside that database, "Create Collection"
//     → copy the Collection ID here.
//
//  3. Inside the collection add ONE attribute:
//        Name: json_data   |  Type: String  |  Size: 1000000
//
//  4. Go to the Collection's "Settings" tab → Permissions
//     → Add role "Any" with Read, Create, Update, Delete checked.
//       (We can lock this down later with auth.)
//
//  5. (Optional) If you want file uploads to go to Appwrite Storage,
//     create a Bucket and paste the ID below.
// =========================================================================
const APPWRITE_DATABASE_ID   = '6a1ceac50029273dcd4b';
const APPWRITE_COLLECTION_ID = 'website_content';
const APPWRITE_BUCKET_ID     = '';   // (optional, for file storage)
const APPWRITE_DOCUMENT_ID   = 'main_content'; // fixed ID for the single data doc

// ─── Initialise SDK ──────────────────────────────────────────────────────
const { Client, Databases, Storage, ID, Query } = Appwrite;

const appwriteClient = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT);

const appwriteDB      = new Databases(appwriteClient);
const appwriteStorage = new Storage(appwriteClient);

// ─── Helper: Load data from Appwrite (returns the full data object) ──────
async function appwriteLoadData(fallbackData) {
  // If no IDs configured yet, fall back to defaults
  if (!APPWRITE_DATABASE_ID || !APPWRITE_COLLECTION_ID) {
    console.warn('[Appwrite] Database/Collection IDs not set — using local fallback.');
    return null;
  }

  try {
    const doc = await appwriteDB.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_ID,
      APPWRITE_DOCUMENT_ID
    );
    const parsed = JSON.parse(doc.json_data);
    console.log('[Appwrite] Data loaded from cloud.');
    return parsed;
  } catch (err) {
    if (err.code === 404) {
      console.log('[Appwrite] No document found — will create on first save.');
      return null; // first run, no document yet
    }
    console.error('[Appwrite] Load error:', err);
    return null;
  }
}

// ─── Helper: Save data to Appwrite ───────────────────────────────────────
async function appwriteSaveData(dataObj) {
  if (!APPWRITE_DATABASE_ID || !APPWRITE_COLLECTION_ID) {
    console.warn('[Appwrite] Database/Collection IDs not set — saving to localStorage only.');
    return false;
  }

  const payload = { json_data: JSON.stringify(dataObj) };

  try {
    // Try to update the existing document
    await appwriteDB.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_ID,
      APPWRITE_DOCUMENT_ID,
      payload
    );
    console.log('[Appwrite] Data saved (updated).');
    return true;
  } catch (err) {
    if (err.code === 404) {
      // Document doesn't exist yet — create it
      try {
        await appwriteDB.createDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_COLLECTION_ID,
          APPWRITE_DOCUMENT_ID,
          payload
        );
        console.log('[Appwrite] Data saved (created).');
        return true;
      } catch (createErr) {
        console.error('[Appwrite] Create error:', createErr);
        return false;
      }
    }
    console.error('[Appwrite] Save error:', err);
    return false;
  }
}
