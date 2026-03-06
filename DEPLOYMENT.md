# Deploying to Railway

This guide walks you through deploying the AI Energy Forecasting System to Railway.

## Prerequisites

1. A [Railway account](https://railway.app/) (free tier available)
2. Your code pushed to a GitHub repository

## Step 1: Deploy the Backend (Django + TensorFlow)

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"** > **"Deploy from GitHub repo"**
3. Select your repository
4. Railway will auto-detect the project. Configure:
   - **Root Directory**: `backend`
   - **Start Command**: `gunicorn energy_project.wsgi --bind 0.0.0.0:$PORT`

5. Add environment variables in the **Variables** tab:
   ```
   SECRET_KEY=your-secure-secret-key-here
   DEBUG=False
   ALLOWED_HOSTS=your-backend-app.railway.app
   CORS_ALLOW_ALL=False
   CORS_ALLOWED_ORIGINS=https://your-frontend-app.railway.app
   ```

6. Click **Deploy** and wait for the build to complete

7. Once deployed, go to **Settings** > **Networking** > **Generate Domain** to get your public URL (e.g., `https://your-backend-app.railway.app`)

## Step 2: Deploy the Frontend (React + Vite)

1. In Railway Dashboard, click **"New"** > **"Service"** in your project
2. Select **"Deploy from GitHub repo"** (same repo)
3. Configure:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Start Command**: `npx serve dist -s -l $PORT`

4. Add environment variable:
   ```
   VITE_API_URL=https://your-backend-app.railway.app/api/forecast/run/
   ```
   (Replace with your actual backend URL from Step 1)

5. Click **Deploy**

6. Generate a domain for the frontend: **Settings** > **Networking** > **Generate Domain**

## Step 3: Update CORS Settings

After both services are deployed:

1. Go to your **Backend** service in Railway
2. Update the `CORS_ALLOWED_ORIGINS` variable with your frontend URL:
   ```
   CORS_ALLOWED_ORIGINS=https://your-frontend-app.railway.app
   ```
3. Redeploy the backend

## Environment Variables Summary

### Backend
| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key | `your-secure-random-string` |
| `DEBUG` | Debug mode | `False` |
| `ALLOWED_HOSTS` | Allowed hosts | `your-backend-app.railway.app` |
| `CORS_ALLOW_ALL` | Allow all CORS | `False` |
| `CORS_ALLOWED_ORIGINS` | Allowed origins | `https://your-frontend.railway.app` |

### Frontend
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://your-backend.railway.app/api/forecast/run/` |

## Troubleshooting

### Build Fails with TensorFlow
- Railway's free tier has 512MB RAM. TensorFlow may need more memory.
- Consider upgrading to a paid plan or using a smaller ML framework.

### CORS Errors
- Ensure `CORS_ALLOWED_ORIGINS` includes your frontend URL
- Make sure the URL doesn't have a trailing slash mismatch

### Model Files Not Found
- Ensure the `ANN/models/` directory is included in your repo
- Check the `ANN_MODEL_DIR` path in settings.py

## Alternative: Deploy Frontend to Vercel

If you prefer, deploy only the frontend to Vercel:

1. Click **"Publish"** in the v0 interface
2. Set the **Root Directory** to `frontend`
3. Add `VITE_API_URL` environment variable pointing to your Railway backend

## Cost Estimate

- **Railway Free Tier**: $5/month credit, sufficient for low-traffic apps
- **Railway Hobby Plan**: $5/month for more resources
- For production with TensorFlow, expect to need ~$10-20/month for adequate resources
