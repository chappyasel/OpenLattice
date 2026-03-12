FROM node:22-slim

# Claude Code (via Agent SDK) requires git and curl at minimum
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install @open-lattice/mcp globally to avoid npx cold start
RUN npm install -g @open-lattice/mcp@latest

WORKDIR /app

COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile 2>/dev/null || yarn install

COPY . .
RUN yarn build

EXPOSE 8080
CMD ["node", "dist/index.js"]
