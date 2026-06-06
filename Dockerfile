FROM node:20-bookworm-slim

# Install necessary system dependencies for video processing
# - python3: required by yt-dlp
# - ffmpeg: required by yt-dlp and Remotion (OffthreadVideo)
# - chromium: installs all the necessary shared Linux libraries for Remotion's headless Chromium
# - curl, ca-certificates: general networking/certificates
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    chromium \
    curl \
    ca-certificates \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Ensure the downloads directory exists and has write permissions
RUN mkdir -p public/downloads && chmod 777 public/downloads

# Build the Next.js application
RUN npm run build

# Start the Next.js server
EXPOSE 3000
CMD ["npm", "start"]
