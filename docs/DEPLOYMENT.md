# Deployment

The hosted API (`https://gym-ontime-backend.onrender.com/api`) runs on **Render's free tier** and sleeps after about 15 minutes without traffic; the first request afterwards can take up to a minute. Background jobs only run while it is awake.

## Settings

Suggested setup: a **Web Service** created from the repository (Node runtime). Adjust to whatever your host asks for.

| Setting | Value |
|---|---|
| Build command | `yarn install && yarn build` |
| Start command | `yarn start` |
| Environment | `PORT` is provided by Render; set the variables below |

| Variable | Notes |
|---|---|
| `MONGO_URI` | MongoDB connection string (for example MongoDB Atlas). Allow Render's outbound addresses in Atlas network access |
| `JWT_SECRET` | Long random value (see [SECURITY.md](../SECURITY.md)) |
| `JWT_EXPIRES_IN` | For example `7d` |
| `PAYSTACK_SECRET_KEY` | Test key (`sk_test_...`) unless taking real payments |
| `FRONTEND_URL` | `https://gym-ontime.vercel.app`. Paystack sends the browser to `${FRONTEND_URL}/payment-success` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Signed image uploads |

## After deploying

1. Open `https://<your-service>.onrender.com/` and expect `API is running`.
2. In the Paystack dashboard set the webhook URL to `https://<your-service>.onrender.com/api/payments/webhook`.
3. If the frontend lives on a new domain, add it to the CORS list in `src/index.ts` (currently `localhost:3000`, `localhost:4000` and `gym-ontime.vercel.app`) and redeploy.
4. The cross-site cookie must be sent with `credentials: "include"` from the frontend, and over https.

Seed an admin only on a new database, then change its password (see the warning in the [README](../README.md#known-limitations)).

## Companion pieces

The frontend ([`Gym_Ontime`](https://github.com/Dev-Jabbar/Gym_Ontime)) is on Vercel and lets visitors choose this API or the [NestJS version](https://github.com/Dev-Jabbar/gym_ontime_nestjs_backend).
