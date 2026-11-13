# CHIT CHAT Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **PII Isolation**: `usersPublic/{uid}` never stores `email`, `phoneE164`, `blockedUids`, or security PIN hashes. Those reside exclusively in `usersPrivate/{uid}` where `uid == request.auth.uid`.
2. **Zero Public User Scraping**: `usernames/{username}` allows `get` by verified signed-in users for exact `@username` lookup, and strictly forbids `list` queries (`allow list: if false`). `usersPublic` forbids `list` queries (`allow list: if false`) so no user directory can ever be enumerated.
3. **Friend-Gated Direct Messaging**: Direct messages (`dm_{uid1}_{uid2}`) and friend requests require authenticated identity matching (`fromUid == request.auth.uid` on create, only `toUid` can accept/decline, only `fromUid` can cancel).
4. **Master Gate Chat Membership**: Reading or writing `/chats/{chatId}/messages/{messageId}` requires membership in the parent `/chats/{chatId}` document (`request.auth.uid in chat.participantIds` or public channel read).
5. **Sender Integrity**: Every message, status, call, friend request, and report enforces `senderId == request.auth.uid` (or `ownerId`/`fromUid`/`callerId`/`reporterUid == request.auth.uid`).
6. **Temporal Integrity**: `createdAt` and `updatedAt` are validated against `request.time` via `serverTimestamp()`, and `createdAt` is immutable on update.
7. **Admin Privilege Isolation**: Users cannot create or elevate records in `/admins/{uid}`; `isAdmin()` checks `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` or verified admin email.

## 2. Dirty Dozen Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated read of private profile**: `GET /usersPrivate/userA` with `auth = null`.
2. **Cross-user PII read**: `GET /usersPrivate/userB` signed in as `userA`.
3. **Directory scraping**: `LIST /usernames` or `LIST /usersPublic` signed in as `userA`.
4. **Shadow field injection on userPublic**: `CREATE /usersPublic/userA` with extra field `isAdmin: true` or `role: "owner"`.
5. **Identity spoofing on message**: `CREATE /chats/chat1/messages/m1` signed in as `userA` with `senderId: "userB"`.
6. **Non-member message read**: `GET /chats/dm_userB_userC/messages/m1` signed in as `userA`.
7. **Unauthorized message edit**: `UPDATE /chats/chat1/messages/m1` changing `text` when `existing().senderId == "userB"` and caller is `userA`.
8. **Friend request auto-accept**: `CREATE /friendRequests/userA_userB` with `status: "accepted"` signed in as `userA`.
9. **Terminal state mutation**: `UPDATE /friendRequests/userA_userB` from `status: "declined"` back to `status: "accepted"`.
10. **ID Poisoning**: `CREATE /usernames/{1500-char-string}` or invalid regex `username: "Admin User!"`.
11. **Report tampering**: `LIST /reports` or `DELETE /reports/r1` signed in as non-admin `userA`.
12. **Client timestamp forgery**: `CREATE /chats/chat1/messages/m1` with backdated `createdAt` timestamp not equal to `request.time`.
