# Blinkit Full-Stack Clone (MERN)

A full-stack grocery delivery style (Blinkit-like) application built using the MERN stack.  
This repository is a monorepo containing both the backend (`/server`) and frontend (`/client`).

## Tech Stack
- Frontend: React + Vite, Redux (for global state), Axios, React Router
- Backend: Node.js, Express.js, Mongoose, JWT, Multer (file uploads), (Stripe planned / integrated if configured)
- Database: MongoDB (Atlas or Local)
- Auth: Access + Refresh Token (JWT)
- Styling: (Assumed TailwindCSS / custom classes)
- Notifications: react-hot-toast

## Features (High-Level)
- User registration, email verification (OTP), login, logout
- Password reset workflow (OTP + reset)
- JWT-based authentication with refresh token rotation
- Role-based access (Admin vs User)
- Category & Subcategory management (Admin)
- Product creation, listing, filtering, search
- Cart (add/update/remove items)
- Discount handling
- Address management
- (If configured) Orders & payment integration (Stripe)
- File/image uploads (product/category/avatar)
- Responsive design (mobile-friendly)

## Repository Structure
```
/client         # Frontend (React)
/server         # Backend (Express + Mongoose)
```

### Run Locally

1. Clone repo:
```bash
git clone https://github.com/Sagar8169/New_blinkit_fullStack_clone.git
cd New_blinkit_fullStack_clone
```

2. Install dependencies:
```bash
cd server && npm install
cd ../client && npm install
```

3. Create `.env` in `/server`:
```
MONGODB_URI=mongodb://localhost:27017/blinkit_clone
PORT=5000
SECRET_KEY_ACCESS_TOKEN=your_access_secret
SECRET_KEY_REFRESH_TOKEN=your_refresh_secret
STRIPE_SECRET_KEY=sk_test_...
CLIENT_URL=http://localhost:5173
```

4. Create `.env` in `/client`:
```
VITE_API_URL=http://localhost:5000
```

5. Start backend:
```bash
cd server
npm run dev   # or node index.js
```

6. Start frontend:
```bash
cd client
npm run dev
```

7. Open: `http://localhost:5173`

## API Base
All API endpoints are prefixed with `/api`.

Examples:
- `POST /api/user/register`
- `POST /api/user/login`
- `POST /api/product/create`
- `GET  /api/cart/get`

## Authentication (Quick Summary)
- On login: server returns `accesstoken` + `refreshToken`
- Frontend stores tokens in `localStorage` (Note: can be improved to httpOnly cookies)
- Axios interceptor attaches `Authorization: Bearer <accesstoken>`
- On 401 → refresh flow calls `/api/user/refresh-token`

## Important Known Issues (To Fix)
| Issue | File | Fix |
|-------|------|-----|
| Refresh token payload uses `id` but controller expects `_id` | `generatedRefreshToken.js` & `user.controller.js` | Use consistent key (either `id` everywhere OR `_id`) |
| Axios refresh logic placed in a request interceptor instead of a response interceptor | `client/src/utils/Axios.js` | Change second `Axios.interceptors.request.use` to `Axios.interceptors.response.use` |
| Some API paths missing leading slash in `SummaryApi.js` (e.g. `api/user/refresh-token`) | `client/src/common/SummaryApi.js` | Add `/` prefix |
| Storing tokens in localStorage (XSS risk) | Frontend | Prefer httpOnly cookies |

## Scripts (Typical)
Backend:
```bash
npm run dev   # nodemon (if configured)
```
Frontend:
```bash
npm run dev
npm run build
```

## Next Steps
For a COMPLETE step-by-step deep dive (beginner friendly + Hinglish), see:
`/docs/technical_guide.md`

## License
Educational / Personal Use. Add a LICENSE file if needed.

---
Happy Building 🚀