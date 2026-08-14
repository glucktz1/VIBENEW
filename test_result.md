#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## Session 8 (Aug 14, 2026) — Gracefy Dashboard Port + Delete Account
### Backend
- NEW router /app/backend/routers/analytics.py — 6 endpoints (admin-only):
  - GET /api/analytics/overview, /trends, /user-demographics, /realtime, /download-stats, /live-listeners
  - Response shapes mirror Gracefy web Dashboard.jsx consumption
- NEW DELETE /api/auth/me — deletes current user + their playlists/transactions/play_events (store compliance). Admin self-delete blocked (403).
- Admin creds: admin@vibe.app / Vibe@2026 (empty password also works for admin)
### Frontend
- Rewrote /app/frontend/app/admin/index.tsx — faithful RN port of Gracefy Dashboard (zinc/violet theme): live banner, downloads banner, 4 primary stat cards, 4 secondary stats, 4 charts (Customer Growth area, Donations area, Content bar, Category pie) + demographics (device/gender/age/location). Uses react-native-gifted-charts. English labels. Content & Users tabs preserved.
- Fixed drawer testID spacing (kebab-case).
- profile.tsx — added "Futa Akaunti" (Delete Account) button + confirmation modal (testIDs: profile-delete-account, delete-account-modal, delete-account-confirm, delete-account-cancel).

## Session 9 (Aug 14, 2026) — Artist Portal + Gracefy Sidebar Redesign
### Backend (routers/artists.py — separate `artists` collection, JWT typ:artist)
- POST /api/artists/register (pending status), /login (403 until approved), GET/PUT /me
- Albums/songs: POST /api/artists/albums, /songs (status pending), GET /albums, /songs
- POST /api/artists/upload-audio (multipart → Emergent Object Storage), GET /api/artists/media/{path} (public playback)
- Earnings (simulated 50 TZS/play): GET /api/artists/earnings; Withdrawals: GET/POST /api/artists/withdrawals
- Admin mgmt (require_admin): GET /api/artists/admin/all, POST /api/artists/admin/{id}/status, GET /api/artists/admin/withdrawals/all, POST /api/artists/admin/withdrawals/{id}/status
- Seed: demo approved artist artist@vibe.app / Artist@2026
### Frontend
- Admin sidebar rebuilt as faithful accordion (groups collapse, Artists & Singers + Withdrawals wired to admin tabs, footer with logout) — matches user's Gracefy screenshot
- Admin new tabs: "artists" (approve/reject/suspend) and "withdrawals" (approve/mark paid/reject)
- Artist portal screens: /artist/login, /artist/register, /artist (dashboard: overview earnings, music upload, withdrawals, profile)
- Entry point on Profile: "Artist Portal" (profile-artist)
- Uses expo-document-picker for audio; platform-aware multipart upload

## Session 11 (Aug 14, 2026) — Content Management + Categories + Analytics Data Usage + Rebrand
### Backend
- admin.py: GET /api/admin/albums (all incl inactive), PUT /api/admin/albums/{id}, PATCH /api/admin/albums/{id}/status, extended create_album (countries, release_date, artist_id, status, tags, category)
- Categories CRUD: GET/POST/DELETE /api/admin/categories
- analytics.py: GET /api/analytics/data-usage?days=30 (total_data_gb, streaming_gb, downloads_gb, listening_minutes, per_day[], minutes_per_day[])
- seed: 8 general music categories (New Releases, Trending, Afrobeat, Bongo Flava, R&B/Soul, Gospel, Reggae, Live Sessions); religious categories removed
### Frontend
- New components: src/components/admin/ContentManager.tsx (Albums & Songs: search, category+monetization filters, list w/ thumbnails+badges+tags, 3-dot actions Edit/Manage Tags/Deactivate/Delete, rich Create/Edit Album form), CategoriesManager.tsx (add/delete categories)
- admin content tab now uses ContentManager; new categories tab uses CategoriesManager
- Analytics tab: sub-tabs Overview | Data Usage; highlight cards (Paid Plays/Free Listens/Conversion); count cards (Albums/Songs/Artists/Users); Data Usage charts
- Rebrand: sidebar Podcasts/Books/Categories, Churches→Production Houses, Religious Leaders→Aggregators; consumer: bible tab→"Vitabu", home quick links → Podcasts/Vitabu/Studio, /podcasts screen added, Neno la Leo removed
