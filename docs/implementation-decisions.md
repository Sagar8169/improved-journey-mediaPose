# Implementation Decisions and Policies

## Task 3: Aggregated Report Compression
**Decision**: Store as-is (no compression at rest)
**Rationale**: 
- Simplifies implementation and debugging
- MongoDB compression at storage level handles efficiency
- 2MB limit keeps finish payload manageable
- Can add compression later if needed

## Task 4: Password Policy
**Rules**:
- Minimum length: 8 characters (practical balance)
- No complexity requirements initially (UX friendly)
- Enforce via zod schema and UI validation
- Consider strengthening in Phase 2 if needed

## Task 5: Email Templates
**Sender**: no-reply@rollmetric.com
**Verification Email**:
- Subject: "Verify your Roll Metrics account"
- Simple HTML template with verification link
- Include brand logo and clear CTA button
- 24-hour token expiration

## Task 6: Unverified Login Policy
**Policy**: Allow login for unverified users but restrict session endpoints
**Implementation**:
- Login returns access token even if emailVerified=false
- Session start/finish endpoints require emailVerified=true
- UI shows verification badge and blocks session recording
- Profile and account management available to unverified users

## Task 7: Local Session Migration
**Plan**:
- One-time migration UI in account page
- Maximum 50 sessions per batch to avoid timeouts
- Clear progress indicator and success confirmation
- Migrate sessions created in last 90 days only
- UX copy: "Upload your local training history to your account"