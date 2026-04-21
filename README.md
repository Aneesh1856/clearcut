# 🚀 Legal Sentinel - Production Deployment

This project is optimized for deployment on **Vercel**.

## 1. Prerequisites
Ensure you have a **Mistral AI API Key** (used for the Gemini 3.1 Pro proxy).

## 2. Deployment Steps
1. Push this code to your GitHub repository.
2. Log in to [Vercel](https://vercel.com).
3. Import the `clearcut` project.
4. **Environment Variables**:
   In the project settings, add the following:
   - `VITE_MISTRAL_API_KEY`: Your Mistral API Key.
5. Click **Deploy**.

## 3. Local Development
```bash
npm install
npm run dev
```

## 4. Android APK
The project includes a Capacitor-ready Android folder. 
1. `npm install`
2. `npx cap sync`
3. `npx cap open android`
