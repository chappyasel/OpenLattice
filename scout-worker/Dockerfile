FROM node:22-slim

# Install @open-lattice/mcp globally to avoid npx cold start
RUN npm install -g @open-lattice/mcp@latest

WORKDIR /app

COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile 2>/dev/null || yarn install

COPY . .
RUN yarn build

EXPOSE 8080
CMD ["node", "dist/index.js"]
